// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Agent V2 API Routes
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { validateEnvelope } from '../../auth/hmac.service.js';
import * as agentService from '../../services/agent.service.js';
import * as jobService from '../../services/job.service.js';
import {
  agentHeartbeatCounter,
  enrollmentCounter,
} from '../../services/metrics.service.js';
import type {
  AgentEnvelope,
  EnrollRequest,
  HeartbeatPayload,
  MetricsPayload,
  InventoryPayload,
  JobResult,
} from '@massvision/shared';

const enrollSchema = z.object({
  enrollment_token: z.string().min(1),
  hostname: z.string().min(1),
  os: z.enum(['windows', 'linux', 'macos']),
  os_version: z.string(),
  arch: z.string(),
  agent_version: z.string(),
  mac_addresses: z.array(z.string()),
});

const envelopeSchema = z.object({
  agent_id: z.string().uuid(),
  ts: z.number(),
  nonce: z.string().min(16),
  type: z.string(),
  payload: z.unknown(),
  hmac: z.string().min(64),
});

// ═══════════════════════════════════════════════════════════════
// Envelope validation middleware
// ═══════════════════════════════════════════════════════════════

async function validateAgentEnvelope(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const envelope = envelopeSchema.parse(request.body) as AgentEnvelope;
  const result = await validateEnvelope(envelope);

  if (!result.valid) {
    reply.code(401).send({
      success: false,
      error: { code: 'ENVELOPE_INVALID', message: result.error },
    });
    return;
  }

  // Attach validated agent info to request
  (request as unknown as Record<string, unknown>).agentRecord = result.agent;
  (request as unknown as Record<string, unknown>).envelope = envelope;
}

export async function agentV2Routes(app: FastifyInstance): Promise<void> {
  // ─── POST /agent-v2/enroll (no envelope needed) ───
  app.post('/agent-v2/enroll', async (request, reply) => {
    const body = enrollSchema.parse(request.body);

    const result = await agentService.enrollAgent(body as EnrollRequest);

    if ('error' in result) {
      enrollmentCounter.inc({ status: 'failed' });
      return reply.code(400).send({
        success: false,
        error: { code: 'ENROLLMENT_FAILED', message: result.error },
      });
    }

    enrollmentCounter.inc({ status: 'success' });
    return reply.code(201).send({ success: true, data: result });
  });

  // ─── POST /agent-v2/heartbeat ───
  app.post('/agent-v2/heartbeat', {
    preHandler: validateAgentEnvelope,
  }, async (request, reply) => {
    const envelope = (request as unknown as Record<string, unknown>).envelope as AgentEnvelope<HeartbeatPayload>;

    await agentService.processHeartbeat(envelope.agent_id, envelope.payload);
    agentHeartbeatCounter.inc();

    // Check for pending jobs
    const nextJob = await jobService.getNextJobForAgent(envelope.agent_id);

    return reply.send({
      success: true,
      data: {
        ack: true,
        pending_job: nextJob ?? null,
      },
    });
  });

  // ─── POST /agent-v2/metrics ───
  app.post('/agent-v2/metrics', {
    preHandler: validateAgentEnvelope,
  }, async (request, reply) => {
    const envelope = (request as unknown as Record<string, unknown>).envelope as AgentEnvelope<MetricsPayload>;

    await agentService.processMetrics(envelope.agent_id, envelope.payload);

    return reply.send({ success: true, data: { ack: true } });
  });

  // ─── POST /agent-v2/inventory ───
  app.post('/agent-v2/inventory', {
    preHandler: validateAgentEnvelope,
  }, async (request, reply) => {
    const envelope = (request as unknown as Record<string, unknown>).envelope as AgentEnvelope<InventoryPayload>;

    await agentService.processInventory(envelope.agent_id, envelope.payload);

    return reply.send({ success: true, data: { ack: true } });
  });

  // ─── POST /agent-v2/job-result ───
  app.post('/agent-v2/job-result', {
    preHandler: validateAgentEnvelope,
  }, async (request, reply) => {
    const envelope = (request as unknown as Record<string, unknown>).envelope as AgentEnvelope<JobResult>;

    try {
      await jobService.processJobResult(envelope.agent_id, envelope.payload);
      return reply.send({ success: true, data: { ack: true } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process job result';
      return reply.code(400).send({
        success: false,
        error: { code: 'JOB_RESULT_FAILED', message },
      });
    }
  });

  // ─── POST /agent-v2/jobs/next ───
  app.post('/agent-v2/jobs/next', {
    preHandler: validateAgentEnvelope,
  }, async (request, reply) => {
    const envelope = (request as unknown as Record<string, unknown>).envelope as AgentEnvelope;

    const job = await jobService.getNextJobForAgent(envelope.agent_id);

    return reply.send({
      success: true,
      data: job ?? null,
    });
  });
}
