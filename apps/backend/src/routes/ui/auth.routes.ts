// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Auth Routes
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  authenticateUser,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  requireAuth,
} from '../../auth/auth.service.js';
import { createAuditLog } from '../../services/audit.service.js';
import { queryOne } from '../../db/connection.js';
import type { JwtPayload, Permission } from '@massvision/shared';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /auth/login ───
  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await authenticateUser(body.email, body.password);

    if ('error' in result) {
      return reply.code(401).send({
        success: false,
        error: { code: 'AUTH_FAILED', message: result.error },
      });
    }

    const { user } = result;

    const accessToken = generateAccessToken(app, {
      sub: user.id,
      org_id: user.organization_id,
      role: user.role_name,
      permissions: user.permissions as Permission[],
    });

    const refreshToken = generateRefreshToken(app, user.id);
    await storeRefreshToken(user.id, refreshToken);

    await createAuditLog({
      organization_id: user.organization_id,
      user_id: user.id,
      action: 'user.login',
      resource_type: 'user',
      resource_id: user.id,
      ip_address: request.ip,
      user_agent: request.headers['user-agent'] ?? '',
    });

    return reply.send({
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role_name,
          organization_id: user.organization_id,
          organization_name: user.org_name,
          permissions: user.permissions,
          avatar_url: user.avatar_url,
          created_at: '',
          last_login: new Date().toISOString(),
        },
      },
    });
  });

  // ─── POST /auth/refresh ───
  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);

    try {
      const decoded = app.jwt.verify<{ sub: string; type: string }>(body.refresh_token);

      if (decoded.type !== 'refresh') {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid token type' },
        });
      }

      const valid = await validateRefreshToken(decoded.sub, body.refresh_token);
      if (!valid) {
        return reply.code(401).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Refresh token revoked' },
        });
      }

      // Fetch user info
      const user = await queryOne<{
        id: string;
        organization_id: string;
        role_name: string;
        permissions: string[];
        is_active: boolean;
      }>(
        `SELECT u.id, u.organization_id, r.name as role_name, r.permissions, u.is_active
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id = $1`,
        [decoded.sub],
      );

      if (!user || !user.is_active) {
        return reply.code(401).send({
          success: false,
          error: { code: 'ACCOUNT_DISABLED', message: 'Account is disabled' },
        });
      }

      const accessToken = generateAccessToken(app, {
        sub: user.id,
        org_id: user.organization_id,
        role: user.role_name,
        permissions: user.permissions as Permission[],
      });

      const newRefreshToken = generateRefreshToken(app, user.id);
      await storeRefreshToken(user.id, newRefreshToken);

      return reply.send({
        success: true,
        data: {
          access_token: accessToken,
          refresh_token: newRefreshToken,
        },
      });
    } catch {
      return reply.code(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' },
      });
    }
  });

  // ─── POST /auth/logout ───
  app.post('/auth/logout', {
    preHandler: requireAuth(app),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    await revokeRefreshToken(user.sub);

    await createAuditLog({
      organization_id: user.org_id,
      user_id: user.sub,
      action: 'user.logout',
      resource_type: 'user',
      resource_id: user.sub,
      ip_address: request.ip,
    });

    return reply.send({ success: true, data: null });
  });

  // ─── GET /auth/me ───
  app.get('/auth/me', {
    preHandler: requireAuth(app),
  }, async (request, reply) => {
    const jwt = request.user as JwtPayload;

    const user = await queryOne<{
      id: string;
      email: string;
      full_name: string;
      avatar_url: string | null;
      organization_id: string;
      org_name: string;
      role_name: string;
      permissions: string[];
      created_at: string;
      last_login: string;
    }>(
      `SELECT u.id, u.email, u.full_name, u.avatar_url, u.organization_id,
              o.name as org_name, r.name as role_name, r.permissions,
              u.created_at, u.last_login
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [jwt.sub],
    );

    if (!user) {
      return reply.code(404).send({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        organization_id: user.organization_id,
        organization_name: user.org_name,
        permissions: user.permissions,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        last_login: user.last_login,
      },
    });
  });
}
