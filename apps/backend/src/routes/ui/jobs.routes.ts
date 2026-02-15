// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - UI Job Routes
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requirePermission } from '../../auth/auth.service.js';
import * as jobService from '../../services/job.service.js';
import { JOB_TYPE_PERMISSION } from '@massvision/shared';
import type { JwtPayload, JobType, Permission } from '@massvision/shared';

const createJobSchema = z.object({
  agent_id: z.string().uuid(),
  type: z.string(),
  payload: z.record(z.unknown()),
  timeout_sec: z.number().int().min(1).max(7200).optional(),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
});

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth(app));

  // ─── POST /jobs ───
  app.post('/jobs', {
    preHandler: requirePermission('jobs.create'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const body = createJobSchema.parse(request.body);

    // Check job-type-specific permission
    const requiredPerm = JOB_TYPE_PERMISSION[body.type as JobType];
    if (requiredPerm && !user.permissions.includes(requiredPerm as Permission)) {
      return reply.code(403).send({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Permission required: ${requiredPerm}`,
        },
      });
    }

    try {
      const job = await jobService.createJob({
        organization_id: user.org_id,
        agent_id: body.agent_id,
        type: body.type as JobType,
        payload: body.payload,
        timeout_sec: body.timeout_sec,
        priority: body.priority,
        created_by: user.sub,
      });

      return reply.code(201).send({ success: true, data: job });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create job';
      return reply.code(400).send({
        success: false,
        error: { code: 'JOB_CREATE_FAILED', message },
      });
    }
  });

  // ─── GET /jobs ───
  app.get('/jobs', {
    preHandler: requirePermission('jobs.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const query = request.query as Record<string, string>;

    const result = await jobService.listJobs({
      organization_id: user.org_id,
      page: parseInt(query.page ?? '1', 10),
      per_page: parseInt(query.per_page ?? '50', 10),
      agent_id: query.agent_id,
      type: query.type,
      status: query.status,
      created_by: query.created_by,
      sort_by: query.sort_by,
      sort_order: query.sort_order as 'asc' | 'desc',
    });

    return reply.send({ success: true, data: result.jobs, meta: result.meta });
  });

  // ─── GET /jobs/:id ───
  app.get('/jobs/:id', {
    preHandler: requirePermission('jobs.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const job = await jobService.getJob(id, user.org_id);
    if (!job) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    return reply.send({ success: true, data: job });
  });

  // ─── GET /jobs/:id/result ───
  app.get('/jobs/:id/result', {
    preHandler: requirePermission('jobs.view'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const job = await jobService.getJob(id, user.org_id);
    if (!job) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Job not found' },
      });
    }

    if (!job.result) {
      return reply.code(404).send({
        success: false,
        error: { code: 'NO_RESULT', message: 'Job result not available yet' },
      });
    }

    return reply.send({ success: true, data: job.result });
  });

  // ─── POST /jobs/:id/cancel ───
  app.post('/jobs/:id/cancel', {
    preHandler: requirePermission('jobs.cancel'),
  }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const cancelled = await jobService.cancelJob(id, user.org_id, user.sub);
    if (!cancelled) {
      return reply.code(400).send({
        success: false,
        error: { code: 'CANCEL_FAILED', message: 'Job cannot be cancelled (already completed or running)' },
      });
    }

    return reply.send({ success: true, data: null });
  });
}
