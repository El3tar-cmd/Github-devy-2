import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { safePath } from '../utils/workspace';
import { killProcessTree } from '../utils/process';
import { resolveInteractiveShellLaunch } from '../utils/shell';

import { handleEventConnection } from './events';

interface TerminalSession {
  bash: any;
  workspaceId: string;
  tabId: string;
  rcFile?: string;
  outputBuffer: string[];
  activeSockets: Set<any>;
}

export const terminalSessions = new Map<string, TerminalSession>();

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function createWorkspaceGuardRc(workspaceRoot: string, workspaceId: string, tabId: string) {
  const safeName = `${workspaceId}_${tabId}`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const rcFile = path.join(os.tmpdir(), `github-devy-terminal-${safeName}.bashrc`);
  const quotedRoot = shellQuote(workspaceRoot);
  const content = `
export AGENT_WORKSPACE_ROOT=${quotedRoot}

_agent_workspace_guard() {
  case "$PWD/" in
    "$AGENT_WORKSPACE_ROOT/"*) return 0 ;;
  esac
  printf '\\n[Security] Terminal cannot leave workspace root. Returning to %s\\n' "$AGENT_WORKSPACE_ROOT"
  builtin cd "$AGENT_WORKSPACE_ROOT" 2>/dev/null || exit 1
}

cd() {
  local target
  local resolved

  if [ "$#" -eq 0 ]; then
    builtin cd "$AGENT_WORKSPACE_ROOT"
    return $?
  fi

  target="$1"
  resolved="$(builtin cd "$target" 2>/dev/null && pwd -P)"
  if [ -n "$resolved" ]; then
    case "$resolved/" in
      "$AGENT_WORKSPACE_ROOT/"*) builtin cd "$@" ;;
      *)
        printf '\\n[Security] Cannot cd outside workspace root: %s\\n' "$AGENT_WORKSPACE_ROOT"
        builtin cd "$AGENT_WORKSPACE_ROOT"
        return 1
        ;;
    esac
  else
    builtin cd "$@"
  fi
  local status=$?
  _agent_workspace_guard
  return $status
}

pushd() {
  builtin pushd "$@"
  local status=$?
  _agent_workspace_guard
  return $status
}

popd() {
  builtin popd "$@"
  local status=$?
  _agent_workspace_guard
  return $status
}

PROMPT_COMMAND="_agent_workspace_guard\${PROMPT_COMMAND:+;$PROMPT_COMMAND}"
alias cd..='cd ..'
builtin cd "$AGENT_WORKSPACE_ROOT" 2>/dev/null || exit 1
`;

  await fs.writeFile(rcFile, content, { mode: 0o600 });
  return rcFile;
}

export function cleanAllTerminalSessions() {
  for (const session of terminalSessions.values()) {
    try {
      killProcessTree(session.bash.pid).catch(() => {
        try { session.bash.kill('SIGKILL'); } catch (_) {}
      });
    } catch (_) {}
    if (session.rcFile) {
      fs.unlink(session.rcFile).catch(() => {});
    }
  }
  terminalSessions.clear();
}

export function setupWebSocketTerminal(server: http.Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', async (ws, req) => {
    try {
      if (handleEventConnection(ws, req)) {
        return;
      }
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

        if (wsPort && !isNaN(wsPort) && wsPort !== 9876) {
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
        // Verify the directory exists. Do not silently recreate it!
        const stat = await fs.stat(wDir);
        if (!stat.isDirectory()) {
          throw new Error('Workspace is not a directory');
        }
      } catch (e) {
        try {
          ws.send('\r\nError: Invalid or inaccessible workspace directory.\r\n');
        } catch (_) {}
        ws.close();
        return;
      }

      let session = terminalSessions.get(sessionKey);
      if (!session) {
        const rcFile = await createWorkspaceGuardRc(wDir, workspaceId, tabId);
        const shellLaunch = resolveInteractiveShellLaunch(rcFile);

        const bash = spawn(shellLaunch.command, shellLaunch.args, { 
          env: { 
            ...process.env, 
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
          }, 
          cwd: wDir,
          detached: process.platform !== 'win32'
        });

        session = {
          bash,
          workspaceId,
          tabId,
          rcFile,
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
            if (session.rcFile) {
              fs.unlink(session.rcFile).catch(() => {});
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
