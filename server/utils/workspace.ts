import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

export const BASE_WORKSPACE_DIR = path.resolve(process.cwd(), '.agent_workspace');

// Helper to get workspace directory based on ID
export function getWorkspaceDir(id?: string) {
  if (!id) throw new Error('workspaceId required');
  
  // If the ID is already an absolute path referencing Termux, use it directly
  if (id.startsWith('/data/data/com.termux/files/home/')) {
    return path.resolve(id);
  }
  
  const safeId = path.basename(id);
  let wDir = path.join(BASE_WORKSPACE_DIR, safeId);

  // Termux absolute path normalization
  const termuxHome = '/data/data/com.termux/files/home';
  if (existsSync(termuxHome)) {
    const cwd = process.cwd();
    if (cwd.startsWith(termuxHome)) {
      wDir = path.resolve(cwd, '.agent_workspace', safeId);
    } else {
      const parentFolderName = path.basename(cwd) || 'Github-devy';
      wDir = path.join(termuxHome, parentFolderName, '.agent_workspace', safeId);
    }
  }

  return wDir;
}

// Ensure workspace exists
export async function initWorkspace(id: string) {
  try {
    const dir = getWorkspaceDir(id);
    await fs.mkdir(dir, { recursive: true });
    // Verify accessibility of the created workspace
    await fs.access(dir);
    return dir;
  } catch (err: any) {
    console.error('Error creating or accessing workspace:', err);
    throw err;
  }
}

// Helper to check path safety
export async function safePath(id: string, subPath: string) {
  const baseDir = path.resolve(getWorkspaceDir(id));
  let wDir = baseDir;
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const visibleSubdirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules');
    const visibleFiles = entries.filter(e => !e.isDirectory() && !e.name.startsWith('.'));
    
    if (visibleSubdirs.length === 1 && visibleFiles.length === 0) {
      wDir = path.resolve(baseDir, visibleSubdirs[0].name);
    }
  } catch (e) {
    // Falls back to base workspace directory on error or if not created yet
  }

  const resolved = path.resolve(wDir, subPath || '.');
  const relative = path.relative(baseDir, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal detected');
  }
  return { wDir, resolved };
}

// Helper to wrap a promise with a timeout
export function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}
