import type { Request } from 'express';

/**
 * Role-based scoping fragments (spec: Employee → own, Dept Head → own dept,
 * Admin / Asset Manager → org-wide).
 *
 * Each helper returns a SQL condition referencing an existing params array —
 * it PUSHES its bind values onto `params` and returns the condition string,
 * or '' when the caller sees everything.
 */

const orgWide = (req: Request): boolean =>
  req.user!.role === 'ADMIN' || req.user!.role === 'ASSET_MANAGER';

/** Scope rows by a "user who owns the row" column (e.g. holder_id, booked_by, raised_by). */
export function scopeByUserColumn(req: Request, column: string, params: unknown[]): string {
  if (orgWide(req)) return '';
  if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
    params.push(req.user!.departmentId);
    return `${column} IN (SELECT id FROM users WHERE department_id = $${params.length})`;
  }
  params.push(req.user!.userId);
  return `${column} = $${params.length}`;
}

/** Scope assets: employees see assets they hold; dept heads see their department's. */
export function scopeAssets(req: Request, alias: string, params: unknown[]): string {
  if (orgWide(req)) return '';
  if (req.user!.role === 'DEPT_HEAD' && req.user!.departmentId) {
    params.push(req.user!.departmentId);
    return `(${alias}.department_id = $${params.length}
             OR ${alias}.id IN (SELECT asset_id FROM allocations al
                                JOIN users hu ON hu.id = al.holder_id
                                WHERE al.status IN ('ACTIVE','RETURN_REQUESTED')
                                  AND hu.department_id = $${params.length}))`;
  }
  params.push(req.user!.userId);
  return `${alias}.id IN (SELECT asset_id FROM allocations
                          WHERE status IN ('ACTIVE','RETURN_REQUESTED') AND holder_id = $${params.length})`;
}
