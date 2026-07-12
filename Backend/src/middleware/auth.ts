import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type Role } from '../lib/tokens.js';
import { fail } from '../lib/respond.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: Role; departmentId: string | null };
    }
  }
}

// Reads the `at` HttpOnly cookie (primary) or an "Authorization: Bearer" header
// (fallback mode, spec §2.1) and attaches req.user = { userId, role, departmentId }.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const token = (req.cookies?.at as string | undefined) ?? bearer;
  if (!token) {
    fail(res, 401, 'Not authenticated');
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    fail(res, 401, 'Not authenticated');
  }
}

// Valid token but role not in the allowed list → 403 (spec §6).
export const requireRole =
  (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      fail(res, 403, 'Insufficient permissions');
      return;
    }
    next();
  };

// Department scoping for Dept Heads (spec §6). Admin and Asset Manager bypass —
// they are organisation-wide. Pass a loader that resolves the target record's
// department_id (used by the asset/transfer/booking modules).
export const requireOwnDepartment =
  (loadDepartmentId: (req: Request) => Promise<string | null>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        fail(res, 401, 'Not authenticated');
        return;
      }
      if (user.role === 'ADMIN' || user.role === 'ASSET_MANAGER') {
        next();
        return;
      }
      const targetDept = await loadDepartmentId(req);
      if (!targetDept || targetDept !== user.departmentId) {
        fail(res, 403, 'This record is outside your department');
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
