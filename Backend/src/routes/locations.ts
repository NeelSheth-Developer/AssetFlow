import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok, fail } from '../lib/respond.js';
import { isUuid } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { logActivity } from '../lib/activity.js';

// Buildings → Floors → Rooms cascade (Screen 4, step 2).
// Reads: any authenticated user. Writes: Admin / Asset Manager.
export const locationsRouter = Router();
locationsRouter.use(requireAuth);

const canManage = requireRole('ADMIN', 'ASSET_MANAGER');

// GET /api/locations — full nested cascade.
locationsRouter.get('/', async (_req, res, next) => {
  try {
    const buildings = await query<{ id: string; building: string; city: string | null }>(
      'SELECT id, building, city FROM locations ORDER BY building',
    );
    const floors = await query<{ id: string; location_id: string; name: string }>(
      'SELECT id, location_id, name FROM floors ORDER BY name',
    );
    const rooms = await query<{ id: string; floor_id: string; name: string }>(
      'SELECT id, floor_id, name FROM rooms ORDER BY name',
    );
    const locations = buildings.rows.map((b) => ({
      id: b.id,
      building: b.building,
      city: b.city,
      floors: floors.rows
        .filter((f) => f.location_id === b.id)
        .map((f) => ({
          id: f.id,
          name: f.name,
          rooms: rooms.rows.filter((r) => r.floor_id === f.id).map((r) => ({ id: r.id, name: r.name })),
        })),
    }));
    return ok(res, 200, 'Locations fetched', { locations });
  } catch (error) {
    next(error);
  }
});

// POST /api/locations — add a building.
locationsRouter.post('/', canManage, async (req, res, next) => {
  try {
    const building = String(req.body.building ?? '').trim();
    const city = String(req.body.city ?? '').trim() || null;
    if (building.length < 2 || building.length > 100) {
      return fail(res, 400, 'building must be 2–100 characters');
    }
    const inserted = await query<{ id: string; building: string; city: string | null }>(
      'INSERT INTO locations (building, city) VALUES ($1, $2) RETURNING id, building, city',
      [building, city],
    );
    logActivity(req.user!.userId, 'SYSTEM', 'LOCATION', inserted.rows[0].id, `Added building ${building}`);
    return ok(res, 201, 'Building added', { location: { ...inserted.rows[0], floors: [] } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/locations/:id — rename building / city.
locationsRouter.patch('/:id', canManage, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Location not found');
    const sets: string[] = [];
    const params: unknown[] = [id];
    if (req.body.building !== undefined) {
      const building = String(req.body.building).trim();
      if (building.length < 2 || building.length > 100) return fail(res, 400, 'building must be 2–100 characters');
      params.push(building);
      sets.push(`building = $${params.length}`);
    }
    if (req.body.city !== undefined) {
      params.push(String(req.body.city ?? '').trim() || null);
      sets.push(`city = $${params.length}`);
    }
    if (!sets.length) return fail(res, 400, 'Nothing to update');
    const updated = await query<{ id: string; building: string; city: string | null }>(
      `UPDATE locations SET ${sets.join(', ')} WHERE id = $1 RETURNING id, building, city`,
      params,
    );
    if (!updated.rowCount) return fail(res, 404, 'Location not found');
    return ok(res, 200, 'Location updated', { location: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id — floors/rooms cascade; assets keep their text
// location but their room_id becomes NULL (FK SET NULL).
locationsRouter.delete('/:id', canManage, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Location not found');
    const deleted = await query<{ building: string }>(
      'DELETE FROM locations WHERE id = $1 RETURNING building',
      [id],
    );
    if (!deleted.rowCount) return fail(res, 404, 'Location not found');
    logActivity(req.user!.userId, 'SYSTEM', 'LOCATION', id, `Deleted building ${deleted.rows[0].building}`);
    return ok(res, 200, 'Location deleted');
  } catch (error) {
    next(error);
  }
});

// POST /api/locations/:id/floors — add a floor to a building.
locationsRouter.post('/:id/floors', canManage, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) return fail(res, 404, 'Location not found');
    const name = String(req.body.name ?? '').trim();
    if (!name || name.length > 100) return fail(res, 400, 'name is required (max 100 characters)');
    const location = await query('SELECT 1 FROM locations WHERE id = $1', [id]);
    if (!location.rowCount) return fail(res, 404, 'Location not found');
    const inserted = await query<{ id: string; name: string }>(
      'INSERT INTO floors (location_id, name) VALUES ($1, $2) RETURNING id, name',
      [id, name],
    );
    return ok(res, 201, 'Floor added', { floor: { ...inserted.rows[0], locationId: id, rooms: [] } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/locations/:id/floors/:floorId — rename a floor.
locationsRouter.patch('/:id/floors/:floorId', canManage, async (req, res, next) => {
  try {
    const { id, floorId } = req.params;
    if (!isUuid(id) || !isUuid(floorId)) return fail(res, 404, 'Floor not found');
    const name = String(req.body.name ?? '').trim();
    if (!name || name.length > 100) return fail(res, 400, 'name is required (max 100 characters)');
    const updated = await query<{ id: string; name: string }>(
      'UPDATE floors SET name = $3 WHERE id = $2 AND location_id = $1 RETURNING id, name',
      [id, floorId, name],
    );
    if (!updated.rowCount) return fail(res, 404, 'Floor not found');
    return ok(res, 200, 'Floor updated', { floor: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id/floors/:floorId — rooms cascade.
locationsRouter.delete('/:id/floors/:floorId', canManage, async (req, res, next) => {
  try {
    const { id, floorId } = req.params;
    if (!isUuid(id) || !isUuid(floorId)) return fail(res, 404, 'Floor not found');
    const deleted = await query('DELETE FROM floors WHERE id = $2 AND location_id = $1', [id, floorId]);
    if (!deleted.rowCount) return fail(res, 404, 'Floor not found');
    return ok(res, 200, 'Floor deleted');
  } catch (error) {
    next(error);
  }
});

// POST /api/locations/:id/floors/:floorId/rooms — add a room to a floor.
locationsRouter.post('/:id/floors/:floorId/rooms', canManage, async (req, res, next) => {
  try {
    const { id, floorId } = req.params;
    if (!isUuid(id) || !isUuid(floorId)) return fail(res, 404, 'Floor not found');
    const name = String(req.body.name ?? '').trim();
    if (!name || name.length > 100) return fail(res, 400, 'name is required (max 100 characters)');
    const floor = await query('SELECT 1 FROM floors WHERE id = $2 AND location_id = $1', [id, floorId]);
    if (!floor.rowCount) return fail(res, 404, 'Floor not found');
    const inserted = await query<{ id: string; name: string }>(
      'INSERT INTO rooms (floor_id, name) VALUES ($1, $2) RETURNING id, name',
      [floorId, name],
    );
    return ok(res, 201, 'Room added', { room: { ...inserted.rows[0], floorId } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/locations/:id/floors/:floorId/rooms/:roomId — rename a room.
locationsRouter.patch('/:id/floors/:floorId/rooms/:roomId', canManage, async (req, res, next) => {
  try {
    const { id, floorId, roomId } = req.params;
    if (!isUuid(id) || !isUuid(floorId) || !isUuid(roomId)) return fail(res, 404, 'Room not found');
    const name = String(req.body.name ?? '').trim();
    if (!name || name.length > 100) return fail(res, 400, 'name is required (max 100 characters)');
    const updated = await query<{ id: string; name: string }>(
      `UPDATE rooms SET name = $4
       WHERE id = $3 AND floor_id = $2
         AND EXISTS (SELECT 1 FROM floors f WHERE f.id = $2 AND f.location_id = $1)
       RETURNING id, name`,
      [id, floorId, roomId, name],
    );
    if (!updated.rowCount) return fail(res, 404, 'Room not found');
    return ok(res, 200, 'Room updated', { room: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/locations/:id/floors/:floorId/rooms/:roomId — assets' room_id → NULL.
locationsRouter.delete('/:id/floors/:floorId/rooms/:roomId', canManage, async (req, res, next) => {
  try {
    const { id, floorId, roomId } = req.params;
    if (!isUuid(id) || !isUuid(floorId) || !isUuid(roomId)) return fail(res, 404, 'Room not found');
    const deleted = await query(
      `DELETE FROM rooms
       WHERE id = $3 AND floor_id = $2
         AND EXISTS (SELECT 1 FROM floors f WHERE f.id = $2 AND f.location_id = $1)`,
      [id, floorId, roomId],
    );
    if (!deleted.rowCount) return fail(res, 404, 'Room not found');
    return ok(res, 200, 'Room deleted');
  } catch (error) {
    next(error);
  }
});
