import { Router, type Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { query, getClient } from '../db/neon.js';
import { config } from '../config.js';
import { createOtp, hashOtp, hashToken } from '../lib/crypto.js';
import { sendOtpEmail } from '../lib/email.js';
import { issueTokens } from '../lib/tokens.js';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  date_of_birth: string | null;
  created_at: string;
}

interface OtpRow {
  id: string;
  otp_hash: string;
  expires_at: string;
  attempts: number;
}

export const authRouter = Router();
const googleClient = new OAuth2Client();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const response = (res: Response, status: number, success: boolean, message: string, data?: object) =>
  res.status(status).json({ success, message, ...(data && { data }), timestamp: new Date().toISOString() });

const loginPayload = (user: UserRow, isNewUser: boolean) => ({
  ...(isNewUser && { is_new_user: true }),
  user: {
    id: user.id,
    name: user.name,
    date_of_birth: user.date_of_birth,
    created_at: user.created_at,
  },
});

authRouter.post('/send-otp', async (req, res, next) => {
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    if (!emailPattern.test(email)) return response(res, 400, false, 'A valid email is required');

    const recent = await query(
      `SELECT 1 FROM email_otps WHERE email = $1 AND created_at > NOW() - INTERVAL '60 seconds' LIMIT 1`,
      [email],
    );
    if (recent.rowCount) return response(res, 429, false, 'Please wait before requesting another OTP');

    const otp = createOtp();
    const otpHash = hashOtp(email, otp);
    const inserted = await query<{ id: string }>(
      `INSERT INTO email_otps (email, otp_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '5 minutes') RETURNING id`,
      [email, otpHash],
    );

    try {
      await sendOtpEmail(email, otp);
    } catch (error) {
      await query('DELETE FROM email_otps WHERE id = $1', [inserted.rows[0].id]);
      throw error;
    }

    req.log.info({ email }, 'OTP sent');
    return response(res, 200, true, 'OTP sent successfully', { email, expires_in: 300 });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/verify-otp', async (req, res, next) => {
  const client = await getClient();
  try {
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const otp = String(req.body.otp ?? '').trim();
    if (!emailPattern.test(email) || !/^\d{6}$/.test(otp)) {
      return response(res, 400, false, 'A valid email and 6-digit OTP are required');
    }

    await client.query('BEGIN');
    const otpResult = await client.query<OtpRow>(
      `SELECT id, otp_hash, expires_at, attempts
       FROM email_otps
       WHERE email = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [email],
    );
    const record = otpResult.rows[0];
    if (!record || new Date(record.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return response(res, 400, false, 'OTP is invalid or expired');
    }
    if (record.attempts >= 5) {
      await client.query('ROLLBACK');
      return response(res, 429, false, 'Too many invalid attempts. Request a new OTP');
    }

    const expected = Buffer.from(record.otp_hash, 'hex');
    const supplied = Buffer.from(hashOtp(email, otp), 'hex');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
      await client.query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [record.id]);
      await client.query('COMMIT');
      return response(res, 400, false, 'OTP is invalid or expired');
    }

    await client.query('UPDATE email_otps SET consumed_at = NOW() WHERE id = $1', [record.id]);
    const existing = await client.query<UserRow>('SELECT * FROM users WHERE email = $1 FOR UPDATE', [email]);
    const isNewUser = existing.rowCount === 0;
    const userResult = isNewUser
      ? await client.query<UserRow>(
          `INSERT INTO users (email, email_verified_at) VALUES ($1, NOW())
           RETURNING id, email, name, date_of_birth, created_at`,
          [email],
        )
      : await client.query<UserRow>(
          `UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
           WHERE id = $1 RETURNING id, email, name, date_of_birth, created_at`,
          [existing.rows[0].id],
        );

    const user = userResult.rows[0];
    const tokens = issueTokens(user);
    const decoded = jwt.decode(tokens.refreshToken) as { exp: number };
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, TO_TIMESTAMP($3))`,
      [user.id, hashToken(tokens.refreshToken), decoded.exp],
    );
    await client.query('COMMIT');

    req.log.info({ userId: user.id, isNewUser, method: 'otp' }, 'Login successful');
    return response(res, isNewUser ? 201 : 200, true,
      isNewUser ? 'Account created successfully' : 'Login successful', {
        ...loginPayload(user, isNewUser),
        auth: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken },
      });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  const client = await getClient();
  try {
    const refreshToken = String(req.body.refresh_token ?? '').trim();
    if (!refreshToken) return response(res, 400, false, 'refresh_token is required');

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, config.refreshSecret, {
        issuer: 'assetflow-api',
        audience: 'api',
      }) as jwt.JwtPayload;
      if (payload.type !== 'refresh') throw new Error('wrong token type');
    } catch {
      return response(res, 401, false, 'Invalid or expired refresh token');
    }

    await client.query('BEGIN');
    const stored = await client.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [hashToken(refreshToken)],
    );
    if (!stored.rowCount) {
      await client.query('ROLLBACK');
      return response(res, 401, false, 'Refresh token is revoked or unknown');
    }

    const userResult = await client.query<UserRow>(
      'SELECT id, email, name, date_of_birth, created_at FROM users WHERE id = $1',
      [stored.rows[0].user_id],
    );
    if (!userResult.rowCount) {
      await client.query('ROLLBACK');
      return response(res, 401, false, 'User no longer exists');
    }

    // Rotation: each refresh token is single-use.
    await client.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [stored.rows[0].id]);
    const user = userResult.rows[0];
    const tokens = issueTokens(user);
    const decoded = jwt.decode(tokens.refreshToken) as { exp: number };
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, TO_TIMESTAMP($3))`,
      [user.id, hashToken(tokens.refreshToken), decoded.exp],
    );
    await client.query('COMMIT');

    req.log.info({ userId: user.id }, 'Tokens rotated');
    return response(res, 200, true, 'Token refreshed successfully', {
      auth: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken },
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

authRouter.post('/google', async (req, res, next) => {
  const client = await getClient();
  try {
    const idToken = String(req.body.id_token ?? '').trim();
    if (!idToken) return response(res, 400, false, 'id_token is required');
    if (!config.google.clientId) return response(res, 503, false, 'Google sign-in is not configured on the server');

    let payload: TokenPayload | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: config.google.clientId });
      payload = ticket.getPayload();
    } catch {
      return response(res, 401, false, 'Invalid Google token');
    }

    const email = String(payload?.email ?? '').trim().toLowerCase();
    if (!payload?.sub || !email || payload.email_verified !== true) {
      return response(res, 401, false, 'Google account email is missing or not verified');
    }

    await client.query('BEGIN');
    let userResult = await client.query<UserRow>(
      `UPDATE users SET updated_at = NOW() WHERE google_sub = $1
       RETURNING id, email, name, date_of_birth, created_at`,
      [payload.sub],
    );
    let isNewUser = false;

    if (!userResult.rowCount) {
      const byEmail = await client.query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1 FOR UPDATE',
        [email],
      );
      if (byEmail.rowCount) {
        userResult = await client.query<UserRow>(
          `UPDATE users SET google_sub = $2,
                            name = COALESCE(name, $3),
                            profile_picture_url = COALESCE(profile_picture_url, $4),
                            email_verified_at = COALESCE(email_verified_at, NOW()),
                            updated_at = NOW()
           WHERE id = $1 RETURNING id, email, name, date_of_birth, created_at`,
          [byEmail.rows[0].id, payload.sub, payload.name ?? null, payload.picture ?? null],
        );
      } else {
        isNewUser = true;
        userResult = await client.query<UserRow>(
          `INSERT INTO users (email, google_sub, name, profile_picture_url, email_verified_at)
           VALUES ($1, $2, $3, $4, NOW())
           RETURNING id, email, name, date_of_birth, created_at`,
          [email, payload.sub, payload.name ?? null, payload.picture ?? null],
        );
      }
    }

    const user = userResult.rows[0];
    const tokens = issueTokens(user);
    const decoded = jwt.decode(tokens.refreshToken) as { exp: number };
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, TO_TIMESTAMP($3))`,
      [user.id, hashToken(tokens.refreshToken), decoded.exp],
    );
    await client.query('COMMIT');

    req.log.info({ userId: user.id, isNewUser, method: 'google' }, 'Login successful');
    return response(res, isNewUser ? 201 : 200, true,
      isNewUser ? 'Account created successfully' : 'Login successful', {
        ...loginPayload(user, isNewUser),
        auth: { access_token: tokens.accessToken, refresh_token: tokens.refreshToken },
      });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});
