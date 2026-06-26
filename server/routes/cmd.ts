import { Router } from 'express';
import { spawn } from 'child_process';
import { safePath } from '../utils/workspace';
import { terminalSessions } from '../websocket/terminal';
import { isProcessAlive, isProcessNotFoundError, killProcessTree } from '../utils/process';
import { resolveShell } from '../utils/shell';

const router = Router();
export const activeProcesses = new Set<any>();

export function killAllBackgroundProcesses() {
  for (const child of activeProcesses) {
    try {
      if (child.pid && !child.killed) {
        killProcessTree(child.pid).catch(() => {
          try { child.kill('SIGKILL'); } catch (_) {}
        });
      }
    } catch (_) {}
  }
  activeProcesses.clear();
}

router.post('/run', async (req, res) => {
  try {
    const { command, workspaceId } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });
    const { wDir } = await safePath(workspaceId, '.');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    const selectedShell = resolveShell();

    let isBackground = false;
    let accumulatedOutput = '';
    const isServerCommand = /npm\s+(run\s+)?(dev|start|serve|watch|preview)|yarn\s+(dev|start|serve|watch|preview)|pnpm\s+(dev|start|serve|watch|preview)|vite|nodemon|python\s+manage\.py\s+runserver|node\s+server|node\s+dist\/server|live-server|http-server|gunicorn|uvicorn|flask\s+run/i.test(command);

    let responseEnded = false;
    const endResponse = () => {
      if (responseEnded) return;
      responseEnded = true;
      try { res.end(); } catch (_) {}
    };
    const returnControlToAgent = (reason: string) => {
      if (responseEnded) return;
      isBackground = true;
      try {
        res.write(`\n\n[${reason}. Process ${child.pid || 'unknown'} is still running in the background. Use list_active_processes to inspect it or kill_process to stop it.]\n`);
      } catch (_) {}
      endResponse();
    };

    const serverReadyTimer = setTimeout(() => {
      const containsServerKeywords = /listening\s+on|running\s+on|http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/0\.0\.0\.0|ready\s+in|compiled\s+successfully|server\s+started|express\s+server|app\s+listening/i.test(accumulatedOutput);
      if (isServerCommand || containsServerKeywords) {
        returnControlToAgent('Process looks like a long-running server');
      }
    }, 4500);

    const child = spawn(command, { 
      shell: selectedShell, 
      cwd: wDir,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      },
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    (child as any).command = command;
    activeProcesses.add(child);

    const foregroundLimitMs = Math.max(1000, Math.min(Number(req.body.foregroundTimeoutMs) || 12000, 120000));
    const foregroundTimer = setTimeout(() => {
      returnControlToAgent(`Foreground command budget exceeded after ${Math.round(foregroundLimitMs / 1000)}s`);
    }, foregroundLimitMs);
    
    req.on('close', () => {
      clearTimeout(serverReadyTimer);
      clearTimeout(foregroundTimer);
      try {
        if (!isBackground && child.pid && !child.killed) {
          killProcessTree(child.pid, 'SIGTERM').catch(() => {
            try { child.kill('SIGTERM'); } catch (_) {}
          });
        }
      } catch (_) {}
    });

    child.on('error', (err) => {
      activeProcesses.delete(child);
      clearTimeout(serverReadyTimer);
      clearTimeout(foregroundTimer);
      console.error('Command tool execution error:', err);
      try {
        res.write(`\nError: ${err.message}`);
        endResponse();
      } catch (_) {}
    });

    if (child.stdout) {
      child.stdout.on('error', (err) => {
        console.error('child stdout error:', err);
      });
      child.stdout.on('data', (data) => {
        accumulatedOutput += data.toString('utf8');
        try { res.write(data); } catch (_) {}
      });
    }

    if (child.stderr) {
      child.stderr.on('error', (err) => {
        console.error('child stderr error:', err);
      });
      child.stderr.on('data', (data) => {
        accumulatedOutput += data.toString('utf8');
        try { res.write(data); } catch (_) {}
      });
    }

    if (child.stdin) {
      child.stdin.on('error', (err) => {
        console.error('child stdin error:', err);
      });
    }

    child.on('close', (code) => {
      activeProcesses.delete(child);
      clearTimeout(serverReadyTimer);
      clearTimeout(foregroundTimer);
      endResponse();
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

router.get('/active', (req, res) => {
  const activeTerminals = Array.from(terminalSessions.entries()).map(([key, session]) => {
    return {
      type: 'terminal',
      id: key,
      workspaceId: session.workspaceId,
      tabId: session.tabId,
      pid: session.bash.pid,
    };
  });

  const activeCmds = Array.from(activeProcesses).flatMap((child) => {
    if (!child.pid || !isProcessAlive(child.pid)) {
      activeProcesses.delete(child);
      return [];
    }

    return [{
      type: 'background',
      id: child.pid,
      pid: child.pid,
      command: (child as any).command || 'Command',
    }];
  });

  res.json({
    terminals: activeTerminals,
    backgrounds: activeCmds,
  });
});

router.post('/kill', async (req, res) => {
  const { type, id } = req.body;
  if (!type || id === undefined) {
    return res.status(400).json({ error: 'type and id are required' });
  }

  if (type === 'terminal') {
    const session = terminalSessions.get(String(id));
    if (session) {
      try {
        // Kill the process group for spawned shells
        try {
          await killProcessTree(session.bash.pid);
        } catch (_) {
          session.bash.kill('SIGKILL');
        }
      } catch (e: any) {
        console.error(`Error killing terminal: ${e.message}`);
      }
      terminalSessions.delete(String(id));
      return res.json({ success: true, message: `Terminal session ${id} killed.` });
    } else {
      return res.status(404).json({ error: `Terminal session ${id} not found.` });
    }
  } else if (type === 'background') {
    const pid = Number(id);
    let found = false;
    
    // First try to find in activeProcesses
    for (const child of activeProcesses) {
      if (child.pid === pid) {
        try {
          await killProcessTree(child.pid);
        } catch (e: any) {
          console.error(`Error killing background process: ${e.message}`);
        }
        activeProcesses.delete(child);
        found = true;
        break;
      }
    }
    
    if (found) {
      return res.json({ success: true, message: `Background process ${pid} killed.` });
    } else {
      // Try direct kill if not found in map (orphaned process)
      try {
        await killProcessTree(pid);
        return res.json({ success: true, message: `Process ${pid} killed.` });
      } catch (e: any) {
        if (isProcessNotFoundError(e)) {
          return res.json({ success: true, alreadyStopped: true, message: `Process ${pid} is already stopped.` });
        }
        return res.status(404).json({ error: `Process ${pid} not found or cannot be killed: ${e.message}` });
      }
    }
  }

  res.status(400).json({ error: 'Invalid process type' });
});

export default router;
