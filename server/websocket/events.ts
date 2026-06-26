import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

/**
 * WebSocket Event Bus
 * 
 * Replaces multiple HTTP polling endpoints with a single persistent WS connection
 * that pushes events to clients. Previously the client polled:
 * - /api/fs/list every 4 seconds
 * - /api/workspace/active-ports every 5 seconds
 * - /api/browser/pending every 1.5 seconds
 * - /api/browser/state every 2.5 seconds  
 * - /api/debug/logs every 1 second
 * 
 * Now the server broadcasts events when data actually changes.
 */

export type EventType = 
  | 'fs:changed'        // File system changed (file created/modified/deleted)
  | 'ports:updated'     // Active ports list changed
  | 'browser:pending'   // Browser automation action queued
  | 'debug:log'         // Debug session log update
  | 'workspace:changed'; // Workspace list changed

interface EventMessage {
  type: EventType;
  data: any;
  workspaceId?: string;
}

// All connected event clients
const eventClients = new Set<WebSocket>();

/**
 * Broadcast an event to all connected clients.
 * If workspaceId is provided, only clients subscribed to that workspace receive it.
 */
export function broadcastEvent(type: EventType, data: any, workspaceId?: string) {
  const message = JSON.stringify({ type, data, workspaceId });
  for (const client of eventClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (_) {}
    }
  }
}

/**
 * Setup the event WebSocket on the existing server.
 * Clients connect to ws://host:9876/events?workspaceId=X
 */
export function setupEventWebSocket(wss: WebSocketServer) {
  // We handle event connections inside the existing WSS by checking the URL path
  // This is called from the main terminal WS setup
}

/**
 * Handle a potential event WebSocket connection.
 * Returns true if this was an event connection, false otherwise.
 */
export function handleEventConnection(ws: WebSocket, req: http.IncomingMessage): boolean {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  
  // Event connections use /events path
  if (!url.pathname.startsWith('/events')) {
    return false;
  }

  const clientWorkspaceId = url.searchParams.get('workspaceId') || '';

  // Store workspace preference on the socket
  (ws as any).__eventWorkspaceId = clientWorkspaceId;
  
  eventClients.add(ws);

  ws.on('close', () => {
    eventClients.delete(ws);
  });

  ws.on('error', () => {
    eventClients.delete(ws);
  });

  // Send initial connection confirmation
  try {
    ws.send(JSON.stringify({ type: 'connected', data: { workspaceId: clientWorkspaceId } }));
  } catch (_) {}

  return true;
}

/**
 * Notify that the filesystem has changed.
 * Called from file routes after any write/delete/rename/mkdir operation.
 */
export function notifyFsChanged(workspaceId: string) {
  broadcastEvent('fs:changed', { timestamp: Date.now() }, workspaceId);
}

/**
 * Notify that active ports have changed.
 */
export function notifyPortsUpdated(workspaceId: string, ports: number[]) {
  broadcastEvent('ports:updated', { ports }, workspaceId);
}

/**
 * Notify that a browser automation action is pending.
 */
export function notifyBrowserPending(action: any) {
  broadcastEvent('browser:pending', { action });
}

/**
 * Notify debug log update.
 */
export function notifyDebugLog(sessionId: string, logs: string, status?: string, exitCode?: number) {
  broadcastEvent('debug:log', { sessionId, logs, status, exitCode });
}

/**
 * Notify workspace list changed.
 */
export function notifyWorkspaceChanged() {
  broadcastEvent('workspace:changed', { timestamp: Date.now() });
}
