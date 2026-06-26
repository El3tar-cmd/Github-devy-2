import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Client-side WebSocket event hook.
 * 
 * Connects to the server's event WebSocket and provides a subscription API.
 * Replaces multiple setInterval-based HTTP polls with a single WS connection
 * that receives push events when data actually changes.
 * 
 * Usage:
 *   const { subscribe, isConnected } = useEventBus(workspaceId);
 *   useEffect(() => {
 *     return subscribe('fs:changed', (data) => { fetchTree(); });
 *   }, [subscribe]);
 */

type EventType = 
  | 'fs:changed'
  | 'ports:updated'
  | 'browser:pending'
  | 'debug:log'
  | 'workspace:changed'
  | 'connected';

type EventHandler = (data: any) => void;

export function useEventBus(workspaceId: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }

    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${window.location.host}/events?workspaceId=${workspaceId}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(event.data);
          const handlers = handlersRef.current.get(msg.type);
          if (handlers) {
            for (const handler of handlers) {
              try {
                handler(msg.data);
              } catch (err) {
                console.error('Event handler error:', err);
              }
            }
          }
        } catch (err) {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsConnected(false);
        wsRef.current = null;

        // Reconnect with exponential backoff (max 30 seconds)
        if (reconnectAttemptsRef.current < 10) {
          const delay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror
      };

    } catch (err) {
      console.warn('Event bus connection failed:', err);
    }
  }, [workspaceId]);

  // Connect on mount / workspaceId change
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  /**
   * Subscribe to an event type. Returns an unsubscribe function.
   * 
   * Usage:
   *   useEffect(() => {
   *     return subscribe('fs:changed', (data) => fetchTree());
   *   }, [subscribe]);
   */
  const subscribe = useCallback((eventType: EventType, handler: EventHandler): (() => void) => {
    if (!handlersRef.current.has(eventType)) {
      handlersRef.current.set(eventType, new Set());
    }
    handlersRef.current.get(eventType)!.add(handler);

    return () => {
      const handlers = handlersRef.current.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          handlersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  return { subscribe, isConnected };
}
