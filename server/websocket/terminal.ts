import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { safePath } from '../utils/workspace';

interface TerminalSession {
  bash: any;
  outputBuffer: string[];
  activeSockets: Set<any>;
}

export function setupWebSocketTerminal(server: http.Server) {
  const terminalSessions = new Map<string, TerminalSession>();
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const workspaceId = url.searchParams.get('workspaceId');
      const tabId = url.searchParams.get('tabId') || 'default';
      const sessionKey = `${workspaceId}_${tabId}`;
      
      if (!workspaceId) {
        // Intercept and proxy WebSocket connection to local port (Vite HMR, Chat WS, etc.)
        let wsPort: number | null = null;
        let wsPath = req.url || '/';

        const portMatch = req.url?.match(/^\/proxy\/(\d+)(.*)/);
        if (portMatch) {
          wsPort = parseInt(portMatch[1], 10);
          wsPath = portMatch[2] || '/';
        } else {
          const cookie = req.headers.cookie;
          if (cookie) {
            const cookieMatch = cookie.match(/last_proxy_port=(\d+)/);
            if (cookieMatch) {
              wsPort = parseInt(cookieMatch[1], 10);
            }
          }
        }

        if (wsPort && !isNaN(wsPort) && wsPort !== 3000) {
          const localWsUrl = `ws://127.0.0.1:${wsPort}${wsPath}`;
          
          // Extract subprotocol from request headers if present
          const protocols = req.headers['sec-websocket-protocol'];
          const protocolArray = protocols ? (Array.isArray(protocols) ? protocols : protocols.split(',').map(p => p.trim())) : undefined;
          
          const localWs = new WebSocket(localWsUrl, protocolArray, {
            headers: {
              ...req.headers,
              host: `127.0.0.1:${wsPort}`
            }
          });

          localWs.on('open', () => {
            ws.on('message', (data) => {
              try { localWs.send(data); } catch (_) {}
            });
            localWs.on('message', (data) => {
              try { ws.send(data); } catch (_) {}
            });
          });

          localWs.on('error', (err) => {
            console.error(`WebSocket Proxy to 127.0.0.1:${wsPort} failed:`, err);
            ws.close();
          });

          localWs.on('close', () => {
            ws.close();
          });

          ws.on('close', () => {
            localWs.close();
          });
          return;
        }

        ws.close();
        return;
      }
      
      let wDir;
      try {
        wDir = (await safePath(workspaceId, '.')).wDir;
        await fs.mkdir(wDir, { recursive: true });
      } catch (e) {
        try {
          ws.send('\r\nError: Invalid or inaccessible workspace directory.\r\n');
        } catch (_) {}
        ws.close();
        return;
      }

      let session = terminalSessions.get(sessionKey);
      if (!session) {
        let selectedShell = process.env.SHELL || '';
        if (!selectedShell || !existsSync(selectedShell)) {
          if (existsSync('/usr/bin/bash')) {
            selectedShell = '/usr/bin/bash';
          } else if (existsSync('/bin/bash')) {
            selectedShell = '/bin/bash';
          } else if (existsSync('/usr/bin/sh')) {
            selectedShell = '/usr/bin/sh';
          } else if (existsSync('/bin/sh')) {
            selectedShell = '/bin/sh';
          } else {
            selectedShell = 'sh';
          }
        }

        const bash = spawn(selectedShell, ['-i'], { 
          env: { 
            ...process.env, 
            TERM: 'xterm-256color',
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
          }, 
          cwd: wDir 
        });

        session = {
          bash,
          outputBuffer: [],
          activeSockets: new Set(),
        };
        terminalSessions.set(sessionKey, session);

        const appendToBuffer = (text: string) => {
          if (!session) return;
          session.outputBuffer.push(text);
          if (session.outputBuffer.length > 2000) {
            session.outputBuffer.shift();
          }
        };

        bash.on('error', (err) => {
          console.error('Terminal process error:', err);
          if (session) {
            for (const socket of session.activeSockets) {
              try { socket.send(`\r\nError starting terminal: ${err.message}\r\n`); } catch (_) {}
            }
          }
        });

        if (bash.stdout) {
          bash.stdout.on('error', (err) => {
            console.error('Terminal stdout error:', err);
          });
          bash.stdout.on('data', (data) => {
            const text = data.toString('utf8');
            appendToBuffer(text);
            if (session) {
              for (const socket of session.activeSockets) {
                try { socket.send(text); } catch (_) {}
              }
            }
          });
        }

        if (bash.stderr) {
          bash.stderr.on('error', (err) => {
            console.error('Terminal stderr error:', err);
          });
          bash.stderr.on('data', (data) => {
            const text = data.toString('utf8');
            appendToBuffer(text);
            if (session) {
              for (const socket of session.activeSockets) {
                try { socket.send(text); } catch (_) {}
              }
            }
          });
        }

        if (bash.stdin) {
          bash.stdin.on('error', (err) => {
            console.error('Terminal stdin error:', err);
          });
        }

        bash.on('close', () => {
          if (session) {
            for (const socket of session.activeSockets) {
              try { socket.close(); } catch (_) {}
            }
          }
          terminalSessions.delete(sessionKey);
        });
      }

      // Add our current connection
      session.activeSockets.add(ws);

      ws.on('error', (err) => {
        console.error('WebSocket terminal client connection error:', err);
      });

      // Replay all buffered lines so far to this connection so they see what happened in the background!
      for (const text of session.outputBuffer) {
        try { ws.send(text); } catch (_) {}
      }

      ws.on('message', (msg) => {
        try {
          if (session && session.bash.stdin && session.bash.stdin.writable) {
            const text = typeof msg === 'string' ? msg : msg.toString('utf8');
            session.bash.stdin.write(text);
          }
        } catch (_) {}
      });

      ws.on('close', () => {
        if (session) {
          session.activeSockets.delete(ws);
          // Do not kill the bash process! This allows the session to remain persistent
          // across tab switches, screen shifts, and workspace reloads!
        }
      });

    } catch (wsErr: any) {
      console.error('WebSocket terminal connection setup error:', wsErr);
      try { ws.close(); } catch (_) {}
    }
  });
}
