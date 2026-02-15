// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - WebSocket Client
// ─────────────────────────────────────────────────────────────

import type { WsMessage } from '@massvision/shared';

type WsEventHandler = (data: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers = new Map<string, Set<WsEventHandler>>();
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;

  constructor() {
    this.url = '';
  }

  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';
    this.url = `${wsUrl}/realtime?token=${token}`;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('[WS] Connected');
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WsMessage;
          this.emit(msg.event, msg.data);
        } catch {
          // Invalid message
        }
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        console.log(`[WS] Disconnected: ${event.code}`);
        this.emit('disconnected', { code: event.code });

        if (event.code !== 4001 && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect(token);
          }, delay);
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection
  }

  subscribe(channel: string): void {
    this.send({ action: 'subscribe', channel });
  }

  unsubscribe(channel: string): void {
    this.send({ action: 'unsubscribe', channel });
  }

  sendShellInput(sessionId: string, data: string): void {
    this.send({ action: 'remote_shell_input', session_id: sessionId, data });
  }

  sendDesktopInput(sessionId: string, events: unknown[]): void {
    this.send({ action: 'remote_desktop_input', session_id: sessionId, events });
  }

  on(event: string, handler: WsEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[WS] Handler error for ${event}:`, error);
      }
    });
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WebSocketClient();
