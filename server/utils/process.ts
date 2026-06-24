import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export async function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGKILL') {
  if (!pid || Number.isNaN(pid)) {
    throw new Error('Valid pid required');
  }

  if (process.platform === 'win32') {
    await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    return;
  }

  try {
    process.kill(-pid, signal);
    return;
  } catch (groupError) {
    try {
      await execFileAsync('pkill', ['-KILL', '-P', String(pid)]);
    } catch (_) {}

    try {
      process.kill(pid, signal);
      return;
    } catch (directError: any) {
      throw directError || groupError;
    }
  }
}

export function isProcessAlive(pid: number) {
  if (!pid || Number.isNaN(pid)) return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (error: any) {
    return error?.code === 'EPERM';
  }
}

export function isProcessNotFoundError(error: any) {
  return error?.code === 'ESRCH' || /no such process|not found/i.test(String(error?.message || error || ''));
}
