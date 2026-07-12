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
}

const publicCategory = (c: CategoryRow) => ({
  id: c.id,
  name: c.name,
  customFields: c.custom_fields,
  status: c.status,
});

// 12.1 GET /api/categories — feeds Screen 4's category picklist.
categoriesRouter.get('/', async (_req, res, next) => {
  try {
    const result = await query<CategoryRow>(
      'SELECT id, name, custom_fields, status FROM categories ORDER BY name ASC',
    );
    return ok(res, 200, 'Categories fetched', { categories: result.rows.map(publicCategory) });
  } catch (error) {
    next(error);
  }
});

categoriesRouter.post('/', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim();
    const customFields = Array.isArray(req.body.customFields) ? req.body.customFields : [];
    if (name.length < 2 || name.length > 100) return fail(res, 400, 'Name must be 2–100 characters');

    try {
      const inserted = await query<CategoryRow>(
        `INSERT INTO categories (name, custom_fields) VALUES ($1, $2)
         RETURNING id, name, custom_fields, status`,
        [name, JSON.stringify(customFields)],
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
    if (!sets.length) return fail(res, 400, 'Nothing to update');

    try {
      const updated = await query<CategoryRow>(
        `UPDATE categories SET ${sets.join(', ')} WHERE id = $1 RETURNING id, name, custom_fields, status`,
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
