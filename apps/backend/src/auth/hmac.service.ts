// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - HMAC Verification for Agent Protocol
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { config } from '../config/index.js';
import type { AgentEnvelope } from '@massvision/shared';
import { queryOne } from '../db/connection.js';
import { redis } from '../db/redis.js';

// ═══════════════════════════════════════════════════════════════
// HMAC Computation & Verification
// ═══════════════════════════════════════════════════════════════

export function computeHmac(agentSecret: string, envelope: Omit<AgentEnvelope, 'hmac'>): string {
  const data = `${envelope.agent_id}|${envelope.ts}|${envelope.nonce}|${envelope.type}|${JSON.stringify(envelope.payload)}`;
  return crypto.createHmac('sha256', agentSecret).update(data).digest('hex');
}

export function verifyHmac(agentSecret: string, envelope: AgentEnvelope): boolean {
  const expected = computeHmac(agentSecret, {
    agent_id: envelope.agent_id,
    ts: envelope.ts,
    nonce: envelope.nonce,
    type: envelope.type,
    payload: envelope.payload,
  });
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(envelope.hmac, 'hex'));
}

// ═══════════════════════════════════════════════════════════════
// Anti-replay nonce check
// ═══════════════════════════════════════════════════════════════

export async function verifyNonce(nonce: string, agentId: string): Promise<boolean> {
  // Atomic check-and-set using SET NX (only succeeds if key doesn't exist)
  const key = `nonce:${nonce}`;
  const result = await redis.set(key, agentId, 'EX', config.AGENT_NONCE_WINDOW_SEC * 2, 'NX');
  return result === 'OK';
}

// ═══════════════════════════════════════════════════════════════
// Time window check
// ═══════════════════════════════════════════════════════════════

export function verifyTimestamp(ts: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - ts);
  return diff <= config.AGENT_NONCE_WINDOW_SEC;
}

// ═══════════════════════════════════════════════════════════════
// Full envelope validation
// ═══════════════════════════════════════════════════════════════

interface AgentRecord {
  id: string;
  agent_secret_hash: string;
  organization_id: string;
  status: string;
}

export async function validateEnvelope(
  envelope: AgentEnvelope,
): Promise<{ valid: true; agent: AgentRecord } | { valid: false; error: string }> {
  // 1. Verify timestamp window
  if (!verifyTimestamp(envelope.ts)) {
    return { valid: false, error: 'Message timestamp outside allowed window' };
  }

  // 2. Verify nonce (anti-replay)
  const nonceOk = await verifyNonce(envelope.nonce, envelope.agent_id);
  if (!nonceOk) {
    return { valid: false, error: 'Nonce already used (replay detected)' };
  }

  // 3. Look up agent
  const agent = await queryOne<AgentRecord>(
    'SELECT id, agent_secret_hash, organization_id, status FROM agents WHERE id = $1',
    [envelope.agent_id],
  );

  if (!agent) {
    return { valid: false, error: 'Unknown agent' };
  }

  // 4. Verify HMAC
  // Agent secret is stored hashed — for HMAC we need the raw secret.
  // We use the HMAC secret derived from agent_secret_hash for simplicity:
  // In production, the agent_secret is exchanged during enrollment and both sides use it.
  // Here we verify using the global HMAC secret + agent_id as the key.
  const hmacKey = crypto
    .createHmac('sha256', config.AGENT_HMAC_SECRET)
    .update(envelope.agent_id)
    .digest('hex');

  const hmacValid = verifyHmacWithKey(hmacKey, envelope);
  if (!hmacValid) {
    return { valid: false, error: 'HMAC verification failed' };
  }

  return { valid: true, agent };
}

function verifyHmacWithKey(key: string, envelope: AgentEnvelope): boolean {
  const data = `${envelope.agent_id}|${envelope.ts}|${envelope.nonce}|${envelope.type}|${JSON.stringify(envelope.payload)}`;
  const expected = crypto.createHmac('sha256', key).update(data).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(envelope.hmac, 'hex'));
  } catch {
    return false;
  }
}
