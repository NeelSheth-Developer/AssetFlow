import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Screen 3 — asset categories with per-category custom fields (spec §8, §12).
// Reads: any authenticated user. Writes: Admin only.
export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

interface CategoryRow {
  id: string;
  name: string;
  custom_fields: unknown;
  status: string;
  parent_id?: string | null;
  icon?: string | null;
  asset_count?: string;
}

const publicCategory = (c: CategoryRow) => ({
  id: c.id,
  name: c.name,
  customFields: c.custom_fields,
  status: c.status,
  parentId: c.parent_id ?? null,
  icon: c.icon ?? null,
  ...(c.asset_count !== undefined && { assetCount: Number(c.asset_count) }),
});

const CAT_SELECT = `
  SELECT c.id, c.name, c.custom_fields, c.status, c.parent_id, c.icon,
         (SELECT COUNT(*) FROM assets a WHERE a.category_id = c.id) AS asset_count
  FROM categories c`;

// 12.1 GET /api/categories — feeds Screen 4's category picklist.
categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await query<CategoryRow>(`${CAT_SELECT} ORDER BY c.name ASC`);
    return ok(res, 200, 'Categories fetched', { categories: result.rows.map(publicCategory) });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/tree — hierarchical view with asset counts (Screen 3 Tab B).
categoriesRouter.get('/tree', async (_req, res, next) => {
  try {
    const result = await query<CategoryRow>(`${CAT_SELECT} ORDER BY c.name ASC`);
    const all = result.rows.map(publicCategory);
    type Node = ReturnType<typeof publicCategory> & { children: Node[] };
    const byId = new Map<string, Node>(all.map((c) => [c.id, { ...c, children: [] as Node[] }]));
    const tree: Node[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else tree.push(node);
    }
    return ok(res, 200, 'Category tree fetched', { tree });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id — single category + custom fields.
categoriesRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isUuid(req.params.id)) return fail(res, 404, 'Category not found');
    const result = await query<CategoryRow>(`${CAT_SELECT} WHERE c.id = $1`, [req.params.id]);
    if (!result.rowCount) return fail(res, 404, 'Category not found');
    return ok(res, 200, 'Category fetched', { category: publicCategory(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// POST /api/categories/:id/custom-fields — Admin adds a field definition.
categoriesRouter.post('/:id/custom-fields', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Category not found');
    const label = String(req.body.label ?? '').trim();
    const key = String(req.body.key ?? '').trim() || label.replace(/\W+(\w)/g, (_, c) => c.toUpperCase()).replace(/\W/g, '');
    const type = String(req.body.type ?? 'text');
    if (!label) return fail(res, 400, 'label is required');
    if (!['text', 'number', 'date', 'select'].includes(type)) {
      return fail(res, 400, 'type must be text, number, date or select');
    }
    const field = {
      id: crypto.randomUUID(),
      label,
      key,
      type,
      required: Boolean(req.body.required),
      ...(type === 'select' && { options: Array.isArray(req.body.options) ? req.body.options : [] }),
    };
    const updated = await query<CategoryRow>(
      `UPDATE categories SET custom_fields = custom_fields || $2::jsonb WHERE id = $1
       RETURNING id, name, custom_fields, status, parent_id, icon`,
      [id, JSON.stringify([field])],
    );
    if (!updated.rowCount) return fail(res, 404, 'Category not found');
    return ok(res, 201, 'Custom field added', { field });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/categories/:id/custom-fields/:fieldId
categoriesRouter.delete('/:id/custom-fields/:fieldId', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id, fieldId } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Category not found');
    const current = await query<{ custom_fields: Array<{ id?: string }> }>(
      'SELECT custom_fields FROM categories WHERE id = $1',
      [id],
    );
    if (!current.rowCount) return fail(res, 404, 'Category not found');
    const fields = current.rows[0].custom_fields ?? [];
    const remaining = fields.filter((f) => f.id !== fieldId);
    if (remaining.length === fields.length) return fail(res, 404, 'Custom field not found');
    await query('UPDATE categories SET custom_fields = $2 WHERE id = $1', [id, JSON.stringify(remaining)]);
    return ok(res, 200, 'Custom field removed');
  } catch (error) {
    next(error);
  }
});

categoriesRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const customFields = Array.isArray(req.body.customFields) ? req.body.customFields : [];
    if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');

    const parentId = isUuid(req.body.parentId) ? req.body.parentId : null;
    try {
      const inserted = await query<CategoryRow>(
        `INSERT INTO categories (name, custom_fields, parent_id, icon) VALUES ($1, $2, $3, $4)
         RETURNING id, name, custom_fields, status, parent_id, icon`,
        [name, JSON.stringify(customFields), parentId, req.body.icon ?? null],
      );
      req.log.info({ adminId: req.user!.userId, categoryId: inserted.rows[0].id }, 'Category created');
      return ok(res, 201, 'Category created', { category: publicCategory(inserted.rows[0]) });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return fail(res, 409, 'Category name already exists');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

categoriesRouter.patch('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Category not found');

    const sets: string[] = [];
    const params: unknown[] = [id];
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');
      params.push(name);
      sets.push(`name = $${params.length}`);
    }
    if (req.body.customFields !== undefined) {
      if (!Array.isArray(req.body.customFields)) return fail(res, 400, 'customFields must be an array');
      params.push(JSON.stringify(req.body.customFields));
      sets.push(`custom_fields = $${params.length}`);
    }
    if (req.body.status !== undefined) {
      const status = String(req.body.status);
      if (status !== 'ACTIVE' && status !== 'INACTIVE') return fail(res, 400, 'Invalid status');
      params.push(status);
      sets.push(`status = $${params.length}`);
    }
    if (req.body.parentId !== undefined) {
      const parentId = req.body.parentId ?? null;
      if (parentId !== null && !isUuid(parentId)) return fail(res, 404, 'Parent category not found');
      if (parentId === id) return fail(res, 400, 'A category cannot be its own parent');
      params.push(parentId);
      sets.push(`parent_id = $${params.length}`);
    }
    if (req.body.icon !== undefined) {
      params.push(req.body.icon || null);
      sets.push(`icon = $${params.length}`);
    }
    if (!sets.length) return fail(res, 400, 'Nothing to update');

    try {
      const updated = await query<CategoryRow>(
        `UPDATE categories SET ${sets.join(', ')} WHERE id = $1
         RETURNING id, name, custom_fields, status, parent_id, icon`,
        params,
      );
      if (!updated.rowCount) return fail(res, 404, 'Category not found');
      req.log.info({ adminId: req.user!.userId, categoryId: id }, 'Category updated');
      return ok(res, 200, 'Category updated', { category: publicCategory(updated.rows[0]) });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return fail(res, 409, 'Category name already exists');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

categoriesRouter.delete('/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Category not found');
    const deleted = await query('DELETE FROM categories WHERE id = $1', [id]);
    if (!deleted.rowCount) return fail(res, 404, 'Category not found');
    req.log.info({ adminId: req.user!.userId, categoryId: id }, 'Category deleted');
    return ok(res, 200, 'Category deleted');
  } catch (error) {
    next(error);
  }
});
