// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - WebSocket Realtime Handler
// ─────────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { redis } from '../db/redis.js';
import Redis from 'ioredis';
import { config } from '../config/index.js';
import { wsConnectionsGauge } from '../services/metrics.service.js';
import type { JwtPayload, WsMessage } from '@massvision/shared';

interface WsClient {
  socket: WebSocket;
  userId: string;
  orgId: string;
  subscriptions: Set<string>;
}

const clients = new Map<string, WsClient>();

export async function setupWebSocket(app: FastifyInstance): Promise<void> {
  // Subscribe to Redis channels for broadcasting
  const subscriber = new Redis(config.REDIS_URL);

  subscriber.subscribe(
    'agent:status_changed',
    'agent:metrics',
    'job:created',
    'job:status_changed',
  );

  subscriber.on('message', (channel: string, message: string) => {
    const data = JSON.parse(message);

    for (const [, client] of clients) {
      try {
        // Multi-tenancy: filter events by organization
        if (data.organization_id && data.organization_id !== client.orgId) continue;

        let event: WsMessage | null = null;

        if (channel === 'agent:status_changed') {
          event = {
            event: 'agent.status_changed',
            data,
            timestamp: Date.now(),
          };
        } else if (channel === 'agent:metrics') {
          // Only send if client is subscribed to this agent
          if (!client.subscriptions.has(`agent:${data.agent_id}`)) continue;
          event = {
            event: 'agent.metrics',
            data,
            timestamp: Date.now(),
          };
        } else if (channel === 'job:status_changed' || channel === 'job:created') {
          event = {
            event: 'job.status_changed',
            data,
            timestamp: Date.now(),
          };
        }

        if (event) {
          client.socket.send(JSON.stringify(event));
        }
      } catch {
        // Client disconnected
      }
    }
  });

  // WebSocket route
  app.get('/realtime', { websocket: true }, (socket, request) => {
    const clientId = Math.random().toString(36).substring(2);

    // Authenticate via query parameter — token is REQUIRED
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.close(4001, 'Authentication required');
      return;
    }

    let userId: string;
    let orgId: string;

    try {
      const decoded = app.jwt.verify<JwtPayload>(token);
      userId = decoded.sub;
      orgId = decoded.org_id;
    } catch {
      socket.close(4001, 'Authentication failed');
      return;
    }

    const client: WsClient = {
      socket,
      userId,
      orgId,
      subscriptions: new Set(),
    };

    clients.set(clientId, client);
    wsConnectionsGauge.inc();

    // Handle incoming messages (subscriptions, shell input, etc.)
    socket.on('message', (rawData: Buffer) => {
      try {
        const msg = JSON.parse(rawData.toString());

        switch (msg.action) {
          case 'subscribe': {
            if (msg.channel) {
              client.subscriptions.add(msg.channel);
            }
            break;
          }
          case 'unsubscribe': {
            if (msg.channel) {
              client.subscriptions.delete(msg.channel);
            }
            break;
          }
          case 'remote_shell_input': {
            // Forward to agent via Redis
            redis.publish(`shell:input:${msg.session_id}`, JSON.stringify({
              data: msg.data,
              user_id: userId,
            }));
            break;
          }
          case 'remote_desktop_input': {
            redis.publish(`desktop:input:${msg.session_id}`, JSON.stringify({
              events: msg.events,
              user_id: userId,
            }));
            break;
          }
        }
      } catch {
        // Invalid message
      }
    });

    const cleanup = () => {
      if (clients.has(clientId)) {
        clients.delete(clientId);
        wsConnectionsGauge.dec();
      }
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);

    // Send welcome message
    socket.send(JSON.stringify({
      event: 'connected',
      data: { client_id: clientId },
      timestamp: Date.now(),
    }));
  });
}

// Broadcast to specific org
export function broadcastToOrg(orgId: string, event: WsMessage): void {
  for (const [, client] of clients) {
    if (client.orgId === orgId) {
      try {
        client.socket.send(JSON.stringify(event));
      } catch {
        // Ignore
      }
    }
  }
}

// Send to specific user
export function sendToUser(userId: string, event: WsMessage): void {
  for (const [, client] of clients) {
    if (client.userId === userId) {
      try {
        client.socket.send(JSON.stringify(event));
      } catch {
        // Ignore
      }
    }
  }
}
