import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import net from 'net';
import { safePath, getWorkspaceDir, BASE_WORKSPACE_DIR } from '../utils/workspace';

const router = Router();

// Helper to copy directory recursively
async function copyDirRecursive(src: string, dest: string, exclude: string[] = ['node_modules', '.git']) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, exclude);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// Helper to check if local port is active
function checkPortActive(port: number): Promise<boolean> {
  const tryConnect = (host: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(250);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  };

  return Promise.any([tryConnect('127.0.0.1'), tryConnect('::1')])
    .then((result) => result)
    .catch(() => false);
}

const COMMON_PORTS = [
  3000, 3001, 3002, 3003, 3004, 3005,
  4200, 5000, 5001, 5173, 5174, 5175, 5176, 5177,
  8000, 8001, 8080, 8081, 8082, 8083, 8084, 8085,
  9000, 9876
];

router.post('/workspace/delete', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    const dir = getWorkspaceDir(workspaceId);
    await fs.rm(dir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/workspace/export-zip', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'workspaceId query parameter is required' });
    }
    const { wDir } = await safePath(workspaceId, '.');

    // Dynamically import adm-zip to prevent issues
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();

    async function addFolderToZip(currentPath: string, relativePath: string = '') {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        if (
          name === 'node_modules' || 
          name === '.git' || 
          name === 'dist' || 
          name === '.agent_workspace' || 
          name === '.chromium-profile' ||
          name === '.parcel-cache' ||
          name === '.next' ||
          name === '.nuxt' ||
          name === '.cache' ||
          name.startsWith('.')
        ) {
          continue;
        }
        const fullPath = path.join(currentPath, name);
        const zipPath = relativePath ? `${relativePath}/${name}` : name;
        if (entry.isDirectory()) {
          zip.addFile(zipPath + '/', Buffer.alloc(0));
          await addFolderToZip(fullPath, zipPath);
        } else {
          const content = await fs.readFile(fullPath);
          zip.addFile(zipPath, content);
        }
      }
    }

    await addFolderToZip(wDir);

    const zipBuffer = zip.toBuffer();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="workspace-${workspaceId}.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);
  } catch (error: any) {
    console.error('Error exporting ZIP:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspace/import-folder', async (req, res) => {
  try {
    const { workspaceId, files, clearFirst, stripPrefix } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });
    if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'files array is required' });

    const baseDir = path.resolve(getWorkspaceDir(workspaceId));
    await fs.mkdir(baseDir, { recursive: true });

    if (clearFirst) {
      const existingEntries = await fs.readdir(baseDir, { withFileTypes: true }).catch(() => []);
      for (const entry of existingEntries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await fs.rm(path.join(baseDir, entry.name), { recursive: true, force: true }).catch(() => {});
      }
    }

    let commonPrefix = '';
    if (stripPrefix !== false && files.length > 0) {
      const firstParts = files[0].relativePath.split('/');
      if (firstParts.length > 1) {
        const candidate = firstParts[0];
        const isCommon = files.every((f: { relativePath: string }) => f.relativePath.startsWith(candidate + '/'));
        if (isCommon) commonPrefix = candidate + '/';
      }
    }

    let written = 0;
    for (const { relativePath, base64 } of files) {
      let safeName = relativePath;
      if (commonPrefix && safeName.startsWith(commonPrefix)) {
        safeName = safeName.slice(commonPrefix.length);
      }
      if (!safeName) continue;

      const targetPath = path.resolve(baseDir, safeName);
      const relative = path.relative(baseDir, targetPath);
      if (relative.startsWith('..') || path.isAbsolute(relative)) continue;

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, Buffer.from(base64, 'base64'));
      written++;
    }

    res.json({ success: true, written });
  } catch (error: any) {
    console.error('Error importing folder:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspace/import-local-path', async (req, res) => {
  try {
    const { localPath } = req.body;
    if (!localPath) return res.status(400).json({ error: 'localPath is required' });

    let resolvedPath = localPath;
    if (resolvedPath.startsWith('~')) {
      const homeDir = process.env.HOME || process.env.USERPROFILE || '/data/data/com.termux/files/home';
      resolvedPath = path.join(homeDir, resolvedPath.slice(1));
    } else {
      resolvedPath = path.resolve(resolvedPath);
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'المسار المحدد ليس مجلداً' });
      }
    } catch {
      return res.status(400).json({ error: 'المسار المحدد غير موجود أو غير قابل للقراءة' });
    }

    const folderName = path.basename(resolvedPath);
    const baseDir = path.resolve(getWorkspaceDir(folderName));
    await fs.mkdir(baseDir, { recursive: true });

    await copyDirRecursive(resolvedPath, baseDir, ['node_modules']);

    res.json({ success: true, folderName });
  } catch (error: any) {
    console.error('Error importing local path:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspace/list-local-dirs', async (req, res) => {
  try {
    const { localPath } = req.body;
    let targetPath = localPath;

    const homeDir = process.env.HOME || process.env.USERPROFILE || '/data/data/com.termux/files/home';

    if (!targetPath) {
      targetPath = homeDir;
    } else if (targetPath.startsWith('~')) {
      targetPath = path.join(homeDir, targetPath.slice(1));
    } else {
      targetPath = path.resolve(targetPath);
    }

    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'المسار المحدد ليس مجلداً' });
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const dirs = entries
      .filter(entry => entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git')
      .map(entry => entry.name)
      .sort();

    res.json({
      success: true,
      currentPath: targetPath,
      parentPath: targetPath === '/' ? null : path.dirname(targetPath),
      dirs,
    });
  } catch (error: any) {
    console.error('Error listing local dirs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspace/import-zip', async (req, res) => {
  try {
    const { workspaceId, zipBase64 } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    if (!zipBase64) {
      return res.status(400).json({ error: 'zipBase64 is required' });
    }

    const { wDir } = await safePath(workspaceId, '.');

    const zipBuffer = Buffer.from(zipBase64, 'base64');
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    const existingEntries = await fs.readdir(wDir, { withFileTypes: true });
    for (const entry of existingEntries) {
      const name = entry.name;
      if (name === 'node_modules' || name === '.git') continue;
      const fullPath = path.join(wDir, name);
      try {
        await fs.rm(fullPath, { recursive: true, force: true });
      } catch (rmError) {
        console.warn(`Could not delete file ${fullPath}:`, rmError);
      }
    }

    let commonPrefix = '';
    const activeEntries = zipEntries.filter(entry => {
      const name = entry.entryName;
      return !name.startsWith('__MACOSX') && !name.includes('.DS_Store');
    });

    if (activeEntries.length > 0) {
      const firstParts = activeEntries[0].entryName.split('/');
      if (firstParts.length > 1 && firstParts[0]) {
        const candidate = firstParts[0] + '/';
        const isCommon = activeEntries.every(entry => entry.entryName.startsWith(candidate));
        if (isCommon) {
          commonPrefix = candidate;
        }
      }
    }

    for (const entry of zipEntries) {
      const name = entry.entryName;
      if (name.startsWith('__MACOSX') || name.includes('.DS_Store')) {
        continue;
      }

      let relativePath = name;
      if (commonPrefix && name.startsWith(commonPrefix)) {
        relativePath = name.slice(commonPrefix.length);
      }

      if (!relativePath) continue;

      const targetFullPath = path.join(wDir, relativePath);

      if (entry.isDirectory) {
        await fs.mkdir(targetFullPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(targetFullPath), { recursive: true });
        await fs.writeFile(targetFullPath, entry.getData());
      }
    }

    res.json({ success: true, message: 'Project imported successfully' });
  } catch (error: any) {
    console.error('Error importing ZIP:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/workspace/active-ports', async (req, res) => {
  try {
    const activePorts: number[] = [];
    const scanPromises = COMMON_PORTS.map(async (port) => {
      const active = await checkPortActive(port);
      if (active) {
        activePorts.push(port);
      }
    });

    await Promise.all(scanPromises);
    activePorts.sort((a, b) => a - b);
    
    res.json({ success: true, ports: activePorts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/workspaces', async (req, res) => {
  try {
    await fs.mkdir(BASE_WORKSPACE_DIR, { recursive: true });
    const entries = await fs.readdir(BASE_WORKSPACE_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    res.json({ workspaces: dirs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/environment/detect', (req, res) => {
  res.json({
    success: true,
    platform: process.platform,
    shell: process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'),
    isWindows: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    isMac: process.platform === 'darwin',
    nodeVersion: process.version,
    cwd: process.cwd()
  });
});

export default router;
