// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - UI Dashboard & Audit Routes
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../../auth/auth.service.js';
import { getDashboardStats } from '../../services/dashboard.service.js';
import { listAuditLogs } from '../../services/audit.service.js';
import type { JwtPayload } from '@massvision/shared';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth(app));

  // ─── GET /dashboard/stats ───
  app.get('/dashboard/stats', {
    preHandler: requirePermission('dashboard.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const stats = await getDashboardStats(user.org_id);
    return reply.send({ success: true, data: stats });
  });

  // ─── GET /audit-logs ───
  app.get('/audit-logs', {
    preHandler: requirePermission('audit.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string>;

    const result = await listAuditLogs({
      organization_id: user.org_id,
      page: parseInt(query.page ?? '1', 10),
      per_page: parseInt(query.per_page ?? '50', 10),
      action: query.action,
      user_id: query.user_id,
      agent_id: query.agent_id,
      resource_type: query.resource_type,
      from_date: query.from_date,
      to_date: query.to_date,
    });

    return reply.send({ success: true, data: result.logs, meta: result.meta });
  });
}
