import { Router } from 'express';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { safePath } from '../utils/workspace';

const router = Router();

router.post('/run', async (req, res) => {
  try {
    const { command, workspaceId } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });
    const { wDir } = await safePath(workspaceId, '.');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    let selectedShell: string | boolean = true;
    if (existsSync('/bin/bash')) {
      selectedShell = '/bin/bash';
    } else if (existsSync('/bin/sh')) {
      selectedShell = '/bin/sh';
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
      }
    });
    
    req.on('close', () => {
      clearTimeout(timeoutTimer);
      try {
        if (!isBackground && child.pid && !child.killed) {
          child.kill();
        }
      } catch (_) {}
    });

    child.on('error', (err) => {
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
      clearTimeout(timeoutTimer);
      try { res.end(); } catch (_) {}
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

export default router;
