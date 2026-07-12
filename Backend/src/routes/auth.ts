import { Router } from "express";
import bcrypt from "bcryptjs";
import { query, getClient } from "../db/neon.js";
import { config } from "../config.js";
import { ok, fail } from "../lib/respond.js";
import {
  emailPattern,
  isAllowedEmailProvider,
  passwordError,
} from "../lib/validate.js";
import { createOtp, hashToken } from "../lib/crypto.js";
import {
  signAccessToken,
  createRefreshToken,
  type Role,
} from "../lib/tokens.js";
import { setAuthCookies, clearAuthCookies } from "../lib/cookies.js";
import {
  sendPasswordResetEmail,
  sendSignupWelcomeEmail,
} from "../lib/email.js";


import { requireAuth } from "../middleware/auth.js";

const BCRYPT_COST = 10;

interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  department_id: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
}

interface OtpRow {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
}

type Querier = { query: typeof query };

export const authRouter = Router();

const publicUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  departmentId: u.department_id,
  status: u.status,
});

/** Mint at + rt for a user and persist the rt hash (spec §2/§3.4). */
async function issueSession(
  db: Querier,
  user: UserRow,
): Promise<{ at: string; rt: string }> {
  const at = signAccessToken({
    userId: user.id,
    role: user.role,
    departmentId: user.department_id,
  });
  const rt = createRefreshToken();
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + make_interval(days => $3))`,
    [user.id, hashToken(rt), config.refreshTokenTtlDays],
  );
  return { at, rt };
}

// 4.1 POST /api/auth/signup — always EMPLOYEE, no OTP, logs straight in.
authRouter.post("/signup", async (req, res, next) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");
    if (name.length < 2 || name.length > 100)
      return fail(res, 400, "Name must be 2–100 characters");
    if (!emailPattern.test(email))
      return fail(res, 400, "Invalid email address");
    if (!isAllowedEmailProvider(email)) {
      return fail(
        res,
        400,
        "Email must be from a supported provider (e.g. Gmail, Outlook, Yahoo)",
      );
    }
    const passwordMsg = passwordError(password);
    if (passwordMsg) return fail(res, 400, passwordMsg);

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    // role is hardcoded to EMPLOYEE — a "role" field in the body is never read (spec §4.1).
    let user: UserRow;
    try {
      const inserted = await query<UserRow>(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, 'EMPLOYEE')
         RETURNING id, name, email, password_hash, role, department_id, status, created_at`,
        [name, email, passwordHash],
      );
      user = inserted.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return fail(res, 409, "Email already registered");
      }
      throw error;
    }

    const { at, rt } = await issueSession({ query }, user);
    setAuthCookies(res, at, rt);

    // Send welcome email in the background
    sendSignupWelcomeEmail(user.email).catch((error) => {
      req.log.error(
        { err: error, userId: user.id },
        "Failed to send welcome email",
      );
    });

    req.log.info({ userId: user.id }, "Signup successful");
    return ok(res, 201, "Account created successfully", {
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// 4.2 POST /api/auth/login
authRouter.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password ?? "");
    if (!email || !password)
      return fail(res, 400, "Email and password are required");

    const result = await query<UserRow>(
      `SELECT id, name, email, password_hash, role, department_id, status, created_at
       FROM users WHERE email = $1`,
      [email],
    );
    const user = result.rows[0];
    // Identical message for unknown email and wrong password — prevents enumeration.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return fail(res, 401, "Invalid credentials");
    }
    if (user.status === "INACTIVE") {
      return fail(res, 403, "Account is inactive. Contact your administrator.");
    }

    const { at, rt } = await issueSession({ query }, user);
    setAuthCookies(res, at, rt);
    req.log.info({ userId: user.id }, "Login successful");
    return ok(res, 200, "Login successful", { user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

// 4.3 POST /api/auth/refresh — rotates the rt, mints a new at.
// Role/department are re-read from the DB so promotions apply without logout.
authRouter.post("/refresh", async (req, res, next) => {
  const client = await getClient();
  try {
    const presented = String(req.cookies?.rt ?? "").trim();
    if (!presented)
      return fail(res, 401, "Session expired. Please log in again.");
    const presentedHash = hashToken(presented);

    await client.query("BEGIN");
    const stored = await client.query<{
      id: string;
      user_id: string;
      expires_at: string;
      revoked_at: string | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens
       WHERE token_hash = $1 FOR UPDATE`,
      [presentedHash],
    );
    const row = stored.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      clearAuthCookies(res);
      return fail(res, 401, "Session expired. Please log in again.");
    }
    // Reuse detection (spec §4.3): a revoked token being replayed means theft —
    // kill every active session for that user.
    if (row.revoked_at) {
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [row.user_id],
      );
      await client.query("COMMIT");
      clearAuthCookies(res);
      req.log.warn(
        { userId: row.user_id },
        "Refresh token reuse detected — all sessions revoked",
      );
      return fail(res, 401, "Session expired. Please log in again.");
    }
    if (new Date(row.expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      clearAuthCookies(res);
      return fail(res, 401, "Session expired. Please log in again.");
    }

    const userResult = await client.query<UserRow>(
      `SELECT id, name, email, password_hash, role, department_id, status, created_at
       FROM users WHERE id = $1`,
      [row.user_id],
    );
    const user = userResult.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      clearAuthCookies(res);
      return fail(res, 401, "Session expired. Please log in again.");
    }
    if (user.status === "INACTIVE") {
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
        [user.id],
      );
      await client.query("COMMIT");
      clearAuthCookies(res);
      return fail(res, 403, "Account is inactive.");
    }

    // Rotation: revoke the old token and chain it to its replacement.
    const at = signAccessToken({
      userId: user.id,
      role: user.role,
      departmentId: user.department_id,
    });
    const rt = createRefreshToken();
    const replacement = await client.query<{ id: string }>(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING id`,
      [user.id, hashToken(rt), config.refreshTokenTtlDays],
    );
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1`,
      [row.id, replacement.rows[0].id],
    );
    await client.query("COMMIT");

    setAuthCookies(res, at, rt);
    return ok(res, 200, "Session refreshed", {
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        departmentId: user.department_id,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// 4.4 POST /api/auth/logout — always 200, clears both cookies.
authRouter.post("/logout", async (req, res, next) => {
  try {
    const presented = String(req.cookies?.rt ?? "").trim();
    if (presented) {
      await query(
        `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
        [hashToken(presented)],
      );
    }
    clearAuthCookies(res);
    return ok(res, 200, "Logged out");
  } catch (error) {
    next(error);
  }
});

// 4.5 GET /api/auth/me — role/department read fresh from the DB, not the token.
authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query<UserRow & { dept_name: string | null }>(
      `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.department_id, u.status, u.created_at,
              d.name AS dept_name
       FROM users u LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = $1`,
      [req.user!.userId],
    );
    const user = result.rows[0];
    if (!user) return fail(res, 401, "Not authenticated");

    return ok(res, 200, "User fetched", {
      user: {
        ...publicUser(user),
        department: user.department_id
          ? { id: user.department_id, name: user.dept_name }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// 4.6 POST /api/auth/forgot-password — emails a 6-digit OTP; anti-enumeration 200.
authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const generic = "If that email is registered, a reset code has been sent.";
    if (!emailPattern.test(email)) return ok(res, 200, generic);

    const result = await query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    const user = result.rows[0];
    if (!user) return ok(res, 200, generic);

    const recent = await query(
      `SELECT 1 FROM password_reset_otps
       WHERE user_id = $1 AND created_at > now() - INTERVAL '60 seconds' LIMIT 1`,
      [user.id],
    );
    if (recent.rowCount) {
      return fail(
        res,
        429,
        "Please wait 60 seconds before requesting another code.",
      );
    }

    const code = createOtp();
    const inserted = await query<{ id: string }>(
      `INSERT INTO password_reset_otps (user_id, code_hash, expires_at)
       VALUES ($1, $2, now() + INTERVAL '10 minutes') RETURNING id`,
      [user.id, await bcrypt.hash(code, BCRYPT_COST)],
    );

    try {
      await sendPasswordResetEmail(email, code);
    } catch (error) {
      await query("DELETE FROM password_reset_otps WHERE id = $1", [
        inserted.rows[0].id,
      ]);
      throw error;
    }

    req.log.info({ userId: user.id }, "Password reset code sent");
    return ok(res, 200, generic);
  } catch (error) {
    next(error);
  }
});

// 4.7 POST /api/auth/reset-password — OTP + new password in ONE request (atomic).
authRouter.post("/reset-password", async (req, res, next) => {
  const client = await getClient();
  try {
    const email = String(req.body.email ?? "")
      .trim()
      .toLowerCase();
    const otp = String(req.body.otp ?? "").trim();
    const newPassword = String(req.body.newPassword ?? "");
    if (!emailPattern.test(email) || !/^\d{6}$/.test(otp)) {
      return fail(res, 400, "Invalid or expired code");
    }
    const passwordMsg = passwordError(newPassword);
    if (passwordMsg) return fail(res, 400, passwordMsg);

    await client.query("BEGIN");
    const userResult = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE email = $1 FOR UPDATE",
      [email],
    );
    const user = userResult.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Invalid or expired code");
    }

    const otpResult = await client.query<OtpRow>(
      `SELECT id, code_hash, expires_at, attempts FROM password_reset_otps
       WHERE user_id = $1 AND consumed = FALSE
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [user.id],
    );
    const record = otpResult.rows[0];
    if (!record || new Date(record.expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Invalid or expired code");
    }
    if (record.attempts >= 5) {
      await client.query("ROLLBACK");
      return fail(res, 429, "Too many attempts. Request a new code.");
    }
    if (!(await bcrypt.compare(otp, record.code_hash))) {
      await client.query(
        "UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1",
        [record.id],
      );
      await client.query("COMMIT");
      return fail(res, 400, "Invalid or expired code");
    }

    await client.query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [user.id, await bcrypt.hash(newPassword, BCRYPT_COST)],
    );
    await client.query(
      "UPDATE password_reset_otps SET consumed = TRUE WHERE id = $1",
      [record.id],
    );
    // Kill every existing session — boots out an attacker if the account was compromised.
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
      [user.id],
    );
    await client.query("COMMIT");

    req.log.info({ userId: user.id }, "Password reset — all sessions revoked");
    return ok(res, 200, "Password updated. You can log in now.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

// 4.8 POST /api/auth/change-password — current session survives, others are revoked.
authRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword ?? "");
    const newPassword = String(req.body.newPassword ?? "");
    const passwordMsg = passwordError(newPassword);
    if (passwordMsg) return fail(res, 400, passwordMsg);

    const result = await query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM users WHERE id = $1",
      [req.user!.userId],
    );
    const user = result.rows[0];
    if (!user) return fail(res, 401, "Not authenticated");
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return fail(res, 400, "Current password is incorrect");
    }

    await query(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      [user.id, await bcrypt.hash(newPassword, BCRYPT_COST)],
    );
    // The rt cookie is scoped to /api/auth, so it rides along here — keep this
    // session alive and revoke every other one.
    const currentRt = String(req.cookies?.rt ?? "").trim();
    await query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL AND token_hash <> $2`,
      [user.id, currentRt ? hashToken(currentRt) : ""],
    );

    req.log.info(
      { userId: user.id },
      "Password changed — other sessions revoked",
    );
    return ok(res, 200, "Password updated");
  } catch (error) {
    next(error);
  }
});
