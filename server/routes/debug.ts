import { Router } from 'express';
import { spawn } from 'child_process';
import { safePath } from '../utils/workspace';
import { notifyDebugLog } from '../websocket/events';
import { killProcessTree } from '../utils/process';
import { resolveShell } from '../utils/shell';

const router = Router();

interface DebugSession {
  id: string;
  command: string;
  logs: string[];
  status: 'running' | 'exited' | 'failed';
  exitCode?: number;
  pid?: number;
}
const debugSessions = new Map<string, DebugSession>();
let debugSessionCounter = 0;

router.post('/start', async (req, res) => {
  try {
    const { workspaceId, command } = req.body;
    if (!command) return res.status(400).json({ error: 'command required' });
    
    const { wDir } = await safePath(workspaceId, '.');
    const sessionId = `dbg_${Date.now()}_${++debugSessionCounter}`;
    
    const selectedShell = resolveShell();

    const child = spawn(command, {
      shell: selectedShell,
      cwd: wDir,
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        FORCE_COLOR: '1'
      }
    });
    
    const session: DebugSession = {
      id: sessionId,
      command,
      logs: [],
      status: 'running',
      pid: child.pid
    };
    debugSessions.set(sessionId, session);
    
    const appendLog = (data: any) => {
      const str = data.toString();
      session.logs.push(str);
      if (session.logs.length > 5000) {
        session.logs.shift();
      }
      notifyDebugLog(sessionId, session.logs.join(''), session.status);
    };
    
    child.stdout.on('data', appendLog);
    child.stderr.on('data', appendLog);
    
    child.on('close', (code) => {
      session.status = code === 0 ? 'exited' : 'failed';
      session.exitCode = code ?? undefined;
      notifyDebugLog(sessionId, session.logs.join(''), session.status, session.exitCode);
    });
    
    child.on('error', (err) => {
      session.status = 'failed';
      session.logs.push(`Process Error: ${err.message}\n`);
      notifyDebugLog(sessionId, session.logs.join(''), session.status);
    });
    
    res.json({ success: true, sessionId, pid: child.pid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logs', (req, res) => {
  const { sessionId } = req.body;
  const session = debugSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    status: session.status,
    exitCode: session.exitCode,
    logs: session.logs.join('')
  });
});

router.post('/kill', async (req, res) => {
  const { sessionId } = req.body;
  const session = debugSessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  
  if (session.status === 'running' && session.pid) {
    try {
      await killProcessTree(session.pid);
    } catch (_) {}
    session.status = 'exited';
    session.logs.push('\n[Process killed by user]\n');
    notifyDebugLog(sessionId, session.logs.join(''), session.status);
  }
  res.json({ success: true });
});

router.get('/sessions', (req, res) => {
  const list = Array.from(debugSessions.values()).map(s => ({
    id: s.id,
    command: s.command,
    status: s.status,
    exitCode: s.exitCode,
    pid: s.pid
  }));
  res.json({ success: true, sessions: list });
});

export default router;
