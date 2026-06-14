import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { safePath, getWorkspaceDir } from '../utils/workspace';

const router = Router();

router.post('/list', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const pkgPath = path.join(wDir, 'package.json');
    
    try {
      await fs.access(pkgPath);
    } catch {
      return res.json({ success: true, hasPackageJson: false, dependencies: {}, devDependencies: {} });
    }
    
    const content = await fs.readFile(pkgPath, 'utf8');
    const parsed = JSON.parse(content);
    res.json({
      success: true,
      hasPackageJson: true,
      name: parsed.name || 'unnamed',
      version: parsed.version || '1.0.0',
      dependencies: parsed.dependencies || {},
      devDependencies: parsed.devDependencies || {}
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
