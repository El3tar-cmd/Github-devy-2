import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { safePath } from '../utils/workspace';
import { terminalSessions } from '../websocket/terminal';

const router = Router();
export const activeProcesses = new Set<any>();

export function killAllBackgroundProcesses() {
  for (const child of activeProcesses) {
    try {
      if (child.pid && !child.killed) {
        child.kill('SIGKILL');
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
    
    let selectedShell: string | boolean = true;
    if (process.platform !== 'win32') {
      const envShell = process.env.SHELL || '';
      if (envShell && existsSync(envShell)) {
        selectedShell = envShell;
      } else if (existsSync('/bin/bash')) {
        selectedShell = '/bin/bash';
      } else if (existsSync('/bin/sh')) {
        selectedShell = '/bin/sh';
      }
    }

    let isBackground = false;
    let accumulatedOutput = '';
    const isServerCommand = /npm\s+(run\s+)?(dev|start|serve|watch|preview)|yarn\s+(dev|start|serve|watch|preview)|pnpm\s+(dev|start|serve|watch|preview)|vite|nodemon|python\s+manage\.py\s+runserver|node\s+server|node\s+dist\/server|live-server|http-server|gunicorn|uvicorn|flask\s+run/i.test(command);

    const timeoutTimer = setTimeout(() => {
      const containsServerKeywords = /listening\s+on|running\s+on|http:\/\/localhost|http:\/\/127\.0\.0\.1|http:\/\/0\.0\.0\.0|ready\s+in|compiled\s+successfully|server\s+started|express\s+server|app\s+listening/i.test(accumulatedOutput);
      if (isServerCommand || containsServerKeywords) {
        isBackground = true;
        try {
          res.write('\n\n[Process continues to run in the background. Returning control to the agent/GUI...]\n');
          res.end();
        } catch (_) {}
      }
    }, 4500);

    const child = spawn(command, { 
      shell: selectedShell, 
      cwd: wDir,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      },
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    (child as any).command = command;
    activeProcesses.add(child);
    
    req.on('close', () => {
      clearTimeout(timeoutTimer);
      try {
        if (!isBackground && child.pid && !child.killed) {
          child.kill();
        }
      } catch (_) {}
    });

    child.on('error', (err) => {
      activeProcesses.delete(child);
      clearTimeout(timeoutTimer);
      console.error('Command tool execution error:', err);
      try {
        res.write(`\nError: ${err.message}`);
        res.end();
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
      clearTimeout(timeoutTimer);
      try { res.end(); } catch (_) {}
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

router.get('/active', (req, res) => {
  const activeTerminals = Array.from(terminalSessions.entries()).map(([key, session]) => {
    const [workspaceId, tabId] = key.split('_');
    return {
      type: 'terminal',
      id: key,
      workspaceId,
      tabId,
      pid: session.bash.pid,
    };
  });

  const activeCmds = Array.from(activeProcesses).map((child) => {
    return {
      type: 'background',
      id: child.pid,
      pid: child.pid,
      command: (child as any).command || 'Command',
    };
  });

  res.json({
    terminals: activeTerminals,
    backgrounds: activeCmds,
  });
});

router.post('/kill', (req, res) => {
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
          process.kill(-session.bash.pid, 'SIGKILL');
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
          child.kill('SIGKILL');
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
        process.kill(pid, 'SIGKILL');
        return res.json({ success: true, message: `Process ${pid} killed.` });
      } catch (e: any) {
        return res.status(404).json({ error: `Process ${pid} not found or cannot be killed: ${e.message}` });
      }
    }
  }

  res.status(400).json({ error: 'Invalid process type' });
});

export default router;
