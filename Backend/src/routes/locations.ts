import { Router } from 'express';
import { query } from '../db/neon.js';
import { ok } from '../lib/respond.js';
import { requireAuth } from '../middleware/auth.js';

// Buildings → Floors → Rooms cascade (Screen 4, step 2).
export const locationsRouter = Router();
locationsRouter.use(requireAuth);

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
