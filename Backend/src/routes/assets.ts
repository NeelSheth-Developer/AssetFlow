import { Router } from 'express';
import multer from 'multer';
import QRCode from 'qrcode';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { scopeAssets } from '../lib/scope.js';
import { logActivity } from '../lib/activity.js';
import { isCloudinaryConfigured, uploadAssetDocument } from '../lib/cloudinary.js';

export const assetsRouter = Router();
assetsRouter.use(requireAuth);

const STATUSES = ['AVAILABLE', 'ALLOCATED', 'UNDER_MAINTENANCE', 'RETIRED', 'DISPOSED', 'LOST'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Only PNG/JPEG images and PDF documents are accepted; anything else is rejected.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'application/pdf']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPEG or PDF files are allowed'));
  },
});

interface AssetRow {
  id: string;
  tag: string;
  name: string;
  serial_no: string | null;
  category_id: string | null;
  category_name: string | null;
  department_id: string | null;
  department_name: string | null;
  status: string;
  condition: string;
  location: string | null;
  room_id: string | null;
  is_bookable: boolean;
  purchase_date: string | null;
  purchase_cost: string | null;
  custom_values: unknown;
  retirement: unknown;
  disposal: unknown;
  created_at: string;
  holder_id?: string | null;
  holder_name?: string | null;
}

const ASSET_SELECT = `
  SELECT a.*, c.name AS category_name, d.name AS department_name,
         h.id AS holder_id, h.name AS holder_name
  FROM assets a
  LEFT JOIN categories c ON c.id = a.category_id
  LEFT JOIN departments d ON d.id = a.department_id
  LEFT JOIN LATERAL (
    SELECT u.id, u.name FROM allocations al JOIN users u ON u.id = al.holder_id
    WHERE al.asset_id = a.id AND al.status IN ('ACTIVE','RETURN_REQUESTED')
    ORDER BY al.allocated_at DESC LIMIT 1
  ) h ON TRUE`;

const publicAsset = (a: AssetRow) => ({
  id: a.id,
  tag: a.tag,
  name: a.name,
  serialNo: a.serial_no,
  category: a.category_id ? { id: a.category_id, name: a.category_name } : null,
  department: a.department_id ? { id: a.department_id, name: a.department_name } : null,
  status: a.status,
  condition: a.condition,
  location: a.location,
  roomId: a.room_id,
  isBookable: a.is_bookable,
  purchaseDate: a.purchase_date,
  purchaseCost: a.purchase_cost !== null ? Number(a.purchase_cost) : null,
  customValues: a.custom_values,
  retirement: a.retirement,
  disposal: a.disposal,
  currentHolder: a.holder_id ? { id: a.holder_id, name: a.holder_name } : null,
  createdAt: a.created_at,
});

// GET /api/assets — paginated list. Scope: Employee → held, DeptHead → dept, Admin/AM → all.
assetsRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const params: unknown[] = [];
    const filters: string[] = [];

    const scope = scopeAssets(req, 'a', params);
    if (scope) filters.push(scope);
    const q = String(req.query.q ?? '').trim();
    if (q) {
      params.push(`%${q}%`);
      filters.push(`(a.name ILIKE $${params.length} OR a.tag ILIKE $${params.length} OR a.serial_no ILIKE $${params.length})`);
    }
    if (isUuid(req.query.categoryId)) { params.push(req.query.categoryId); filters.push(`a.category_id = $${params.length}`); }
    if (isUuid(req.query.departmentId)) { params.push(req.query.departmentId); filters.push(`a.department_id = $${params.length}`); }
    const status = String(req.query.status ?? '');
    if (STATUSES.includes(status)) { params.push(status); filters.push(`a.status = $${params.length}`); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const total = await query<{ count: string }>(`SELECT COUNT(*) AS count FROM assets a ${where}`, params);
    const rows = await query<AssetRow>(
      `${ASSET_SELECT} ${where} ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );
    return ok(res, 200, 'Assets fetched', {
      assets: rows.rows.map(publicAsset),
      total: Number(total.rows[0].count),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/search?q= — quick lookup by tag / serial / name (⌘K, QR scan).
assetsRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return fail(res, 400, 'q is required');
    const params: unknown[] = [];
    const scope = scopeAssets(req, 'a', params);
    params.push(`%${q}%`);
    const rows = await query<AssetRow>(
      `${ASSET_SELECT} WHERE ${scope ? scope + ' AND ' : ''}
         (a.tag ILIKE $${params.length} OR a.serial_no ILIKE $${params.length} OR a.name ILIKE $${params.length})
       ORDER BY a.tag ASC LIMIT 20`,
      params,
    );
    return ok(res, 200, 'Search results', { assets: rows.rows.map(publicAsset) });
  } catch (error) {
    next(error);
  }
});

// POST /api/assets/bulk-delete — Admin only.
assetsRouter.post('/bulk-delete', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.filter(isUuid) : [];
    if (!ids.length) return fail(res, 400, 'ids must be a non-empty array of asset ids');
    const deleted = await query(`DELETE FROM assets WHERE id = ANY($1::uuid[])`, [ids]);
    logActivity(req.user!.userId, 'ASSET', 'ASSET', null, `Bulk-deleted ${deleted.rowCount} asset(s)`);
    return ok(res, 200, `${deleted.rowCount} asset(s) deleted`, { deletedCount: deleted.rowCount });
  } catch (error) {
    next(error);
  }
});

// POST /api/assets — register (Admin / Asset Manager). Tag auto-generates if omitted.
assetsRouter.post('/', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    if (name.length < 2) return fail(res, 400, 'Asset name is required');
    let tag = String(req.body.tag ?? '').trim();
    if (!tag) {
      const last = await query<{ n: string }>(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(tag, '\\D', '', 'g'), '')::int), 0) AS n FROM assets`,
      );
      tag = `AF-${String(Number(last.rows[0].n) + 1).padStart(4, '0')}`;
    }
    const categoryId = isUuid(req.body.categoryId) ? req.body.categoryId : null;
    const departmentId = isUuid(req.body.departmentId) ? req.body.departmentId : null;
    const roomId = isUuid(req.body.roomId) ? req.body.roomId : null;

    try {
      const inserted = await query<{ id: string }>(
        `INSERT INTO assets (tag, name, serial_no, category_id, department_id, condition, location,
                             room_id, is_bookable, purchase_date, purchase_cost, custom_values, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          tag, name, req.body.serialNo ?? null, categoryId, departmentId,
          String(req.body.condition ?? 'GOOD'), req.body.location ?? null, roomId,
          Boolean(req.body.isBookable), req.body.purchaseDate || null,
          req.body.purchaseCost ?? null, JSON.stringify(req.body.customValues ?? {}),
          req.user!.userId,
        ],
      );
      const created = await query<AssetRow>(`${ASSET_SELECT} WHERE a.id = $1`, [inserted.rows[0].id]);
      logActivity(req.user!.userId, 'ASSET', 'ASSET', inserted.rows[0].id, `Registered asset ${tag} — ${name}`);
      return ok(res, 201, 'Asset registered', { asset: publicAsset(created.rows[0]) });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return fail(res, 409, 'Asset tag already exists');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/:id — full detail incl. documents.
assetsRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Asset not found');
    const params: unknown[] = [];
    const scope = scopeAssets(req, 'a', params);
    params.push(req.params.id);
    const result = await query<AssetRow>(
      `${ASSET_SELECT} WHERE ${scope ? scope + ' AND ' : ''} a.id = $${params.length}`,
      params,
    );
    if (!result.rowCount) {
      const exists = await query('SELECT 1 FROM assets WHERE id = $1', [req.params.id]);
      return fail(res, exists.rowCount ? 403 : 404, exists.rowCount ? 'This record is outside your department' : 'Asset not found');
    }
    const docs = await query(
      `SELECT id, url, filename, mime, bytes, created_at FROM asset_documents WHERE asset_id = $1 ORDER BY created_at DESC`,
      [req.params.id],
    );
    return ok(res, 200, 'Asset fetched', {
      asset: { ...publicAsset(result.rows[0]), documents: docs.rows },
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/assets/:id — Admin / Asset Manager.
assetsRouter.patch('/:id', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Asset not found');
    const sets: string[] = [];
    const params: unknown[] = [id];
    const push = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (req.body.name !== undefined) push('name', String(req.body.name).trim());
    if (req.body.serialNo !== undefined) push('serial_no', req.body.serialNo || null);
    if (req.body.categoryId !== undefined) push('category_id', isUuid(req.body.categoryId) ? req.body.categoryId : null);
    if (req.body.departmentId !== undefined) push('department_id', isUuid(req.body.departmentId) ? req.body.departmentId : null);
    if (req.body.condition !== undefined) push('condition', String(req.body.condition));
    if (req.body.location !== undefined) push('location', req.body.location || null);
    if (req.body.roomId !== undefined) push('room_id', isUuid(req.body.roomId) ? req.body.roomId : null);
    if (req.body.isBookable !== undefined) push('is_bookable', Boolean(req.body.isBookable));
    if (req.body.purchaseDate !== undefined) push('purchase_date', req.body.purchaseDate || null);
    if (req.body.purchaseCost !== undefined) push('purchase_cost', req.body.purchaseCost ?? null);
    if (req.body.customValues !== undefined) push('custom_values', JSON.stringify(req.body.customValues ?? {}));
    if (req.body.status !== undefined) {
      if (!STATUSES.includes(String(req.body.status))) return fail(res, 400, 'Invalid status');
      push('status', String(req.body.status));
    }
    if (!sets.length) return fail(res, 400, 'Nothing to update');
    sets.push('updated_at = now()');

    const updated = await query(`UPDATE assets SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, params);
    if (!updated.rowCount) return fail(res, 404, 'Asset not found');
    const result = await query<AssetRow>(`${ASSET_SELECT} WHERE a.id = $1`, [id]);
    logActivity(req.user!.userId, 'ASSET', 'ASSET', id, `Updated asset ${result.rows[0].tag}`);
    return ok(res, 200, 'Asset updated', { asset: publicAsset(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/:id/history — allocation + maintenance timeline.
assetsRouter.get('/:id/history', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Asset not found');
    const allocations = await query(
      `SELECT al.id, al.status, al.allocated_at, al.returned_at, al.expected_return_date,
              al.condition_on_return, u.name AS holder_name
       FROM allocations al JOIN users u ON u.id = al.holder_id
       WHERE al.asset_id = $1 ORDER BY al.allocated_at DESC`,
      [req.params.id],
    );
    const maintenance = await query(
      `SELECT id, issue, status, priority, created_at, resolved_at, resolution_notes
       FROM maintenance_requests WHERE asset_id = $1 ORDER BY created_at DESC`,
      [req.params.id],
    );
    return ok(res, 200, 'Asset history fetched', {
      allocationHistory: allocations.rows.map((a) => ({
        id: a.id,
        date: a.allocated_at,
        event: `Allocated to ${a.holder_name}`,
        status: a.status,
        expectedReturnDate: a.expected_return_date,
        returnedAt: a.returned_at,
        conditionOnReturn: a.condition_on_return,
      })),
      maintenanceHistory: maintenance.rows.map((m) => ({
        id: m.id,
        date: m.created_at,
        event: m.issue,
        status: m.status,
        priority: m.priority,
        resolvedAt: m.resolved_at,
        resolutionNotes: m.resolution_notes,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/assets/:id/documents — multipart "file" field → Cloudinary.
assetsRouter.post('/:id/documents', requireRole('ADMIN', 'ASSET_MANAGER'), (req, res, next) => {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 413, `File must be at most ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    }
    if (error) return fail(res, 400, error instanceof Error ? error.message : 'Invalid upload');
    next();
  });
}, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Asset not found');
    if (!req.file) return fail(res, 400, 'A "file" field is required (multipart/form-data)');
    if (!isCloudinaryConfigured()) return fail(res, 503, 'Cloudinary is not configured on the server');
    const asset = await query<{ tag: string }>('SELECT tag FROM assets WHERE id = $1', [id]);
    if (!asset.rowCount) return fail(res, 404, 'Asset not found');

    const uploaded = await uploadAssetDocument(req.file.buffer, id, req.file.originalname, req.file.mimetype);
    const saved = await query(
      `INSERT INTO asset_documents (asset_id, url, filename, mime, bytes, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, url, filename, mime, bytes, created_at`,
      [id, uploaded.secure_url, req.file.originalname, req.file.mimetype, uploaded.bytes ?? req.file.size, req.user!.userId],
    );
    logActivity(req.user!.userId, 'ASSET', 'ASSET', id, `Uploaded document to ${asset.rows[0].tag}`);
    return ok(res, 201, 'Document uploaded', { document: saved.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/assets/:id/qr — QR code (PNG data URL) encoding the asset tag.
assetsRouter.get('/:id/qr', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Asset not found');
    const asset = await query<{ id: string; tag: string }>('SELECT id, tag FROM assets WHERE id = $1', [req.params.id]);
    if (!asset.rowCount) return fail(res, 404, 'Asset not found');
    const payload = JSON.stringify({ app: 'assetflow', assetId: asset.rows[0].id, tag: asset.rows[0].tag });
    const qrUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
    return ok(res, 200, 'QR generated', { tag: asset.rows[0].tag, qrUrl });
  } catch (error) {
    next(error);
  }
});

// Lifecycle transitions: retire → dispose, or mark lost.
async function transition(
  req: Parameters<Parameters<typeof assetsRouter.post>[1]>[0],
  id: string,
  to: string,
  extra: { column?: 'retirement' | 'disposal'; payload?: object },
): Promise<{ tag: string } | null> {
  const sets = ['status = $2', 'updated_at = now()'];
  const params: unknown[] = [id, to];
  if (extra.column) {
    params.push(JSON.stringify(extra.payload ?? {}));
    sets.push(`${extra.column} = $${params.length}`);
  }
  const updated = await query<{ tag: string }>(
    `UPDATE assets SET ${sets.join(', ')} WHERE id = $1 RETURNING tag`,
    params,
  );
  return updated.rows[0] ?? null;
}

// POST /api/assets/:id/retire — asset must not be allocated or under maintenance.
assetsRouter.post('/:id/retire', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Asset not found');
    const current = await query<{ status: string }>('SELECT status FROM assets WHERE id = $1', [id]);
    if (!current.rowCount) return fail(res, 404, 'Asset not found');
    if (current.rows[0].status !== 'AVAILABLE') return fail(res, 400, 'Asset must be Available to retire');

    const row = await transition(req, id, 'RETIRED', {
      column: 'retirement',
      payload: { reason: req.body.reason ?? null, retirementDate: req.body.retirementDate ?? null, by: req.user!.userId },
    });
    logActivity(req.user!.userId, 'ASSET', 'ASSET', id, `Retired asset ${row!.tag}`);
    return ok(res, 200, 'Asset retired', { asset: { id, tag: row!.tag, status: 'RETIRED' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/assets/:id/dispose — only from RETIRED.
assetsRouter.post('/:id/dispose', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Asset not found');
    const current = await query<{ status: string }>('SELECT status FROM assets WHERE id = $1', [id]);
    if (!current.rowCount) return fail(res, 404, 'Asset not found');
    if (current.rows[0].status !== 'RETIRED') return fail(res, 400, 'Asset must be Retired before disposal');

    const row = await transition(req, id, 'DISPOSED', {
      column: 'disposal',
      payload: {
        method: req.body.method ?? null, notes: req.body.notes ?? null,
        disposalDate: req.body.disposalDate ?? null, by: req.user!.userId,
      },
    });
    logActivity(req.user!.userId, 'ASSET', 'ASSET', id, `Disposed asset ${row!.tag}`);
    return ok(res, 200, 'Asset disposed', { asset: { id, tag: row!.tag, status: 'DISPOSED' } });
  } catch (error) {
    next(error);
  }
});

// POST /api/assets/:id/mark-lost
assetsRouter.post('/:id/mark-lost', requireRole('ADMIN', 'ASSET_MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Asset not found');
    const current = await query<{ status: string; tag: string }>(
      'SELECT status, tag FROM assets WHERE id = $1',
      [id],
    );

    if (!current.rowCount) return fail(res, 404, 'Asset not found');

    if (current.rows[0].status === 'LOST') {
      return ok(res, 200, 'Asset is already marked as lost', {
        asset: {
          id,
          tag: current.rows[0].tag,
          status: 'LOST',
        },
      });
    }
    const row = await transition(req, id, 'LOST', {});
    if (!row) return fail(res, 404, 'Asset not found');
    logActivity(req.user!.userId, 'ASSET', 'ASSET', id, `Marked asset ${row.tag} as lost`);
    return ok(res, 200, 'Asset marked as lost', { asset: { id, tag: row.tag, status: 'LOST' } });
  } catch (error) {
    next(error);
  }
});
