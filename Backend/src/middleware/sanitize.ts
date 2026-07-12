import type { NextFunction, Request, Response } from 'express';

const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_LENGTH = 5000;
const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// All C0 control characters except \t \n \r, plus DEL.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === 'string') {
    return value.replace(CONTROL_CHARS, '').trim().slice(0, MAX_STRING_LENGTH);
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => clean(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(key)) continue;
      result[key] = clean(entry, depth + 1);
    }
    return result;
  }
  return value;
}

// Trims strings, strips control characters, caps lengths/depth, and drops
// prototype-polluting keys from body, query, and params.
export function sanitize(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body);
  if (req.params && typeof req.params === 'object') {
    req.params = clean(req.params) as Request['params'];
  }
  if (req.query && typeof req.query === 'object') {
    const cleaned = clean(req.query) as Record<string, unknown>;
    for (const key of Object.keys(req.query)) delete (req.query as Record<string, unknown>)[key];
    Object.assign(req.query, cleaned);
  }
  next();
}
