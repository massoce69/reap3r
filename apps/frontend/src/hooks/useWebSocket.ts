// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - WebSocket Hook
// ─────────────────────────────────────────────────────────────

'use client';

import { useEffect, useCallback, useRef } from 'react';
import { wsClient } from '@/lib/websocket';

export function useWebSocket(event: string, handler: (data: unknown) => void) {
  useEffect(() => {
    const unsubscribe = wsClient.on(event, handler);
    return unsubscribe;
  }, [event, handler]);
}

/**
 * Subscribe to a specific WebSocket event with a stable callback ref
 * (avoids re-subscribe on every render).
 */
export function useWebSocketEvent(event: string, handler: (data: unknown) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (data: unknown) => handlerRef.current(data);
    const unsubscribe = wsClient.on(event, stableHandler);
    return unsubscribe;
  }, [event]);
}

/**
 * Returns a stable send function to push messages over the WebSocket.
 */
export function useWebSocketSend() {
  return useCallback((data: Record<string, unknown>) => {
    wsClient.send(data);
  }, []);
}

export function useAgentSubscription(agentId: string) {
  useEffect(() => {
    if (!agentId) return;

    wsClient.subscribe(`agent:${agentId}`);
    return () => {
      wsClient.unsubscribe(`agent:${agentId}`);
    };
  }, [agentId]);
}

export function useWsConnection() {
  const connect = useCallback((token: string) => {
    wsClient.connect(token);
  }, []);

  const disconnect = useCallback(() => {
    wsClient.disconnect();
  }, []);

  return { connect, disconnect, isConnected: wsClient.isConnected };
}
