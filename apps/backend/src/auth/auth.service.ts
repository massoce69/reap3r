// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Auth Service (JWT + RBAC)
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Permission, JwtPayload } from '@massvision/shared';
import { queryOne } from '../db/connection.js';
import { config } from '../config/index.js';

// ═══════════════════════════════════════════════════════════════
// Password hashing
// ═══════════════════════════════════════════════════════════════

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ═══════════════════════════════════════════════════════════════
// JWT Token Management
// ═══════════════════════════════════════════════════════════════

export function generateAccessToken(app: FastifyInstance, payload: Omit<JwtPayload, 'iat' | 'exp' | 'type'>): string {
  return app.jwt.sign(
    { ...payload, type: 'access' },
    { expiresIn: config.JWT_ACCESS_EXPIRY },
  );
}

export function generateRefreshToken(app: FastifyInstance, userId: string): string {
  return app.jwt.sign(
    { sub: userId, type: 'refresh' },
    { expiresIn: config.JWT_REFRESH_EXPIRY },
  );
}

// ═══════════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════════

interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_active: boolean;
  is_super_admin: boolean;
  organization_id: string;
  role_id: string;
  role_name: string;
  org_name: string;
  permissions: string[];
  avatar_url: string | null;
  locked_until: Date | null;
  failed_login_attempts: number;
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<{ user: DbUser } | { error: string }> {
  const user = await queryOne<DbUser>(
    `SELECT u.id, u.email, u.password_hash, u.full_name, u.is_active, u.is_super_admin,
            u.organization_id, u.role_id, u.avatar_url, u.locked_until, u.failed_login_attempts,
            r.name as role_name, r.permissions,
            o.name as org_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     JOIN organizations o ON o.id = u.organization_id
     WHERE u.email = $1`,
    [email.toLowerCase()],
  );

  if (!user) {
    return { error: 'Invalid email or password' };
  }

  if (!user.is_active) {
    return { error: 'Account is disabled' };
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return { error: 'Account is temporarily locked. Try again later.' };
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    // Increment failed attempts
    const newAttempts = (user.failed_login_attempts || 0) + 1;
    const lockUntil = newAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await queryOne(
      `UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3`,
      [newAttempts, lockUntil, user.id],
    );

    return { error: 'Invalid email or password' };
  }

  // Reset failed attempts on success
  await queryOne(
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1`,
    [user.id],
  );

  return { user };
}

// ═══════════════════════════════════════════════════════════════
// RBAC Middleware
// ═══════════════════════════════════════════════════════════════

export function requireAuth(_app: FastifyInstance) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      await request.jwtVerify();
      const payload = request.user as JwtPayload;

      if (payload.type !== 'access') {
        reply.code(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token type' } });
        return;
      }
    } catch {
      reply.code(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
  };
}

export function requirePermission(...permissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user as JwtPayload;

    if (!user || !user.permissions) {
      reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const hasPermission = permissions.every((p) => user.permissions.includes(p));

    if (!hasPermission) {
      reply.code(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required permissions: ${permissions.join(', ')}`,
        },
      });
      return;
    }
  };
}

export function requireAnyPermission(...permissions: Permission[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user as JwtPayload;

    if (!user || !user.permissions) {
      reply.code(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      return;
    }

    const hasAny = permissions.some((p) => user.permissions.includes(p));

    if (!hasAny) {
      reply.code(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Required one of: ${permissions.join(', ')}`,
        },
      });
      return;
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// Refresh token store (hashed in DB)
// ═══════════════════════════════════════════════════════════════

export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const hash = await bcrypt.hash(token, 6);
  await queryOne('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [hash, userId]);
}

export async function validateRefreshToken(userId: string, token: string): Promise<boolean> {
  const user = await queryOne<{ refresh_token_hash: string | null }>(
    'SELECT refresh_token_hash FROM users WHERE id = $1 AND is_active = TRUE',
    [userId],
  );

  if (!user?.refresh_token_hash) return false;
  return bcrypt.compare(token, user.refresh_token_hash);
}

export async function revokeRefreshToken(userId: string): Promise<void> {
  await queryOne('UPDATE users SET refresh_token_hash = NULL WHERE id = $1', [userId]);
}
