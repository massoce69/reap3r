// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - UI Agent Routes
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import { requireAuth, requirePermission } from '../../auth/auth.service.js';
import * as agentService from '../../services/agent.service.js';
import type { JwtPayload } from '@massvision/shared';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // Apply auth to all routes
  app.addHook('preHandler', requireAuth(app));

  // ─── GET /agents ───
  app.get('/agents', {
    preHandler: requirePermission('agents.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string>;

    const result = await agentService.listAgents({
      organization_id: user.org_id,
      page: parseInt(query.page ?? '1', 10),
      per_page: parseInt(query.per_page ?? '50', 10),
      search: query.search,
      status: query.status,
      os: query.os,
      tags: query.tags ? query.tags.split(',') : undefined,
      sort_by: query.sort_by,
      sort_order: query.sort_order as 'asc' | 'desc',
    });

    return reply.send({ success: true, data: result.agents, meta: result.meta });
  });

  // ─── GET /agents/:id ───
  app.get('/agents/:id', {
    preHandler: requirePermission('agents.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const agent = await agentService.getAgent(id, user.org_id);
    if (!agent) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    return reply.send({ success: true, data: agent });
  });

  // ─── GET /agents/:id/metrics ───
  app.get('/agents/:id/metrics', {
    preHandler: requirePermission('agents.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string>;

    // Verify agent belongs to org
    const agent = await agentService.getAgent(id, user.org_id);
    if (!agent) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    const from = query.from ?? new Date(Date.now() - 3600000).toISOString();
    const to = query.to ?? new Date().toISOString();
    const limit = parseInt(query.limit ?? '100', 10);

    const metrics = await agentService.getAgentMetrics(id, from, to, limit);
    return reply.send({ success: true, data: metrics });
  });

  // ─── GET /agents/:id/inventory/latest ───
  app.get('/agents/:id/inventory/latest', {
    preHandler: requirePermission('agents.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const agent = await agentService.getAgent(id, user.org_id);
    if (!agent) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    const inventory = await agentService.getAgentLatestInventory(id);
    if (!inventory) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_INVENTORY', message: 'No inventory data available' },
      });
    }

    return reply.send({ success: true, data: inventory });
  });

  // ─── DELETE /agents/:id ───
  app.delete('/agents/:id', {
    preHandler: requirePermission('agents.delete'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const deleted = await agentService.deleteAgent(id, user.org_id);
    if (!deleted) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Agent not found' },
      });
    }

    return reply.send({ success: true, data: null });
  });
}
