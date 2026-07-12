import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

// Verifies the "Authorization: Bearer <access_token>" header and attaches
// req.user. Rejects missing, malformed, expired, or non-access tokens.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({
      success: false,
      message: 'Access token required (Authorization: Bearer <token>)',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    const payload = jwt.verify(token, config.accessSecret, {
      issuer: 'assetflow-api',
      audience: 'api',
    }) as jwt.JwtPayload;
    if (payload.type !== 'access' || !payload.sub) throw new Error('wrong token type');
    req.user = { id: String(payload.sub), email: String(payload.email ?? '') };
    next();
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired access token',
      timestamp: new Date().toISOString(),
    });
  }
}
