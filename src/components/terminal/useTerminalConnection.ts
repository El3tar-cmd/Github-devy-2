import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export function useTerminalConnection(
  workspaceId: string,
  activeTabId: string,
  executionMode: 'http' | 'ws'
) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string>(
    '=== Terminal Stream Logs ===\r\nType commands in the console assistant box or input directly on the terminal canvas.\r\nOutputs are fully synchronized with the host sandbox process in real-time.\r\n\r\n'
  );

  // Reset terminal state when workspace changes
  useEffect(() => {
    setLogContent(`=== Terminal Stream Logs — Workspace: ${workspaceId} ===\r\nWorkspace switched. Terminal session isolated to this workspace.\r\n\r\n`);
    setError(null);
    setReconnectAttempts(0);
    setConnectionStatus('connecting');
  }, [workspaceId]);

  // Main Terminal & Multi-tunnel Connection Lifecycle
  useEffect(() => {
    if (!terminalRef.current) return;
    if (!workspaceId) {
      setError('No active developer workspace loaded.');
      return;
    }

    const term = new Terminal({
      theme: {
        background: '#0a0a0f',
        foreground: '#f1f5f9',
        cursor: '#10b981',
        cursorAccent: '#0a0a0f',
        selectionBackground: 'rgba(16, 185, 129, 0.25)',
        black: '#020205',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#ec4899',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#f472b6',
        brightCyan: '#22d3ee',
        brightWhite: '#f8fafc',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", "JetBrains Mono", monospace',
      fontSize: 13,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Direct canvas setup delay to prevent width calculations being 0 during transitions
    const deferredFit = setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (_) {}
    }, 80);

    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const connectWebSocket = () => {
      if (!isComponentMounted) return;

      const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProto}//${window.location.host}?workspaceId=${workspaceId}&tabId=${activeTabId}`;
      setConnectionStatus(prev => (prev === 'error' || prev === 'disconnected') ? 'reconnecting' : 'connecting');

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isComponentMounted) return;
          setConnectionStatus('connected');
          setReconnectAttempts(0);
          setError(null);
          term.write('\r\n\x1b[1;32m● [Terminal Connected Successfully - Realtime WS Mode active]\x1b[0m\r\n');
        };

        ws.onmessage = (event) => {
          if (!isComponentMounted) return;
          const text = event.data;
          if (typeof text === 'string') {
            term.write(text);
            setLogContent(prev => {
              const next = prev + text;
              return next.length > 80000 ? '...[Logs truncated to save memory]...\r\n' + next.slice(-60000) : next;
            });
          }
        };

        ws.onclose = () => {
          if (!isComponentMounted) return;
          setConnectionStatus('disconnected');
          term.write('\r\n\x1b[1;33m⚠️ [Terminal WebSocket disconnected - Switch to HTTP fallbacks or Reconnecting...]\x1b[0m\r\n');
          
          // Exponential backoff reconnect policies under Termux/Sandbox network spikes
          if (executionMode === 'ws' && reconnectAttempts < 5) {
            const nextDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            setReconnectAttempts(prev => prev + 1);
            reconnectTimer = setTimeout(() => {
              connectWebSocket();
            }, nextDelay);
          } else {
            setConnectionStatus('error');
            setError('Real-time terminal connection persistent drop. Use HTTP manual mode fallback below to write commands.');
          }
        };

        ws.onerror = (e) => {
          console.warn('Sandbox socket connection issue, safe retry scheduled:', e);
        };

      } catch (wsSetupError: any) {
        console.error('Core local host WebSocket binding failed:', wsSetupError);
        if (isComponentMounted) {
          setConnectionStatus('error');
          setError(`WS Bind Error: ${wsSetupError.message}`);
        }
      }
    };

    if (executionMode === 'ws') {
      connectWebSocket();
    } else {
      setConnectionStatus('disconnected');
      setReconnectAttempts(0);
      setError(null);
      term.write('\r\n\x1b[1;33m[HTTP Terminal Mode active - commands run through streamed HTTP]\x1b[0m\r\n');
    }

    // Key inputs directly over terminal characters
    const onDataDisposable = term.onData(data => {
      if (ws && ws.readyState === WebSocket.OPEN && executionMode === 'ws') {
        ws.send(data);
      }
    });

    // Elegant element-level ResizeObserver to handle pane collapses and mobile sliders correctly
    const resizeObserver = new ResizeObserver((entries) => {
      if (!isComponentMounted || !entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
          } catch (_) {}
        });
      }
    });

    if (terminalRef.current && terminalRef.current.parentElement) {
      resizeObserver.observe(terminalRef.current.parentElement);
    }

    return () => {
      isComponentMounted = false;
      clearTimeout(deferredFit);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      onDataDisposable.dispose();
      resizeObserver.disconnect();
      
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch (_) {}
      }

      try {
        term.dispose();
      } catch (_) {}

      xtermRef.current = null;
      wsRef.current = null;
    };
  }, [workspaceId, activeTabId, executionMode]);

  return {
    terminalRef,
    wsRef,
    xtermRef,
    connectionStatus,
    reconnectAttempts,
    error,
    setError,
    logContent,
    setLogContent,
  };
}
