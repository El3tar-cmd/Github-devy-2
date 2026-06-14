import { Router } from 'express';
import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { safePath, getWorkspaceDir, withTimeout } from '../utils/workspace';

const router = Router();

// Prevent Git commands inside workspaces from traversing up to the IDE's own Git repo
process.env.GIT_CEILING_DIRECTORIES = path.resolve(process.cwd());

router.post('/clone', async (req, res) => {
  try {
    const { repoUrl, token, workspaceId } = req.body;
    if (!repoUrl) return res.status(400).json({ error: 'repoUrl required' });
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    let finalWorkspaceId = workspaceId;
    try {
      const trimmed = repoUrl.trim().replace(/\/$/, "");
      const parts = trimmed.split("/");
      let last = parts[parts.length - 1];
      if (last.endsWith(".git")) {
        last = last.slice(0, -4);
      }
      if (last) {
        finalWorkspaceId = last.replace(/[^a-zA-Z0-9_.-]/g, "_");
      }
    } catch (e) {
      console.error("Failed to parse repo name in server clone API:", e);
    }

    let wDir = getWorkspaceDir(finalWorkspaceId);
    let successfullyInitialized = false;
    let attempt = 1;

    while (!successfullyInitialized && attempt <= 2) {
      try {
        // Clear existing workspace
        try {
          await fs.rm(wDir, { recursive: true, force: true });
        } catch (_) {}

        // Ensure and verify directory exists and is fully accessible
        await fs.mkdir(wDir, { recursive: true });
        await fs.access(wDir);
        
        successfullyInitialized = true;
      } catch (err: any) {
        console.error(`Attempt ${attempt} to initialize workspace at ${wDir} failed:`, err);
        
        // If an ENOENT error occurs or if we are in a Termux environment, fallback to a normalized absolute path
        if (attempt === 1 && (err.code === 'ENOENT' || err.message.includes('ENOENT') || existsSync('/data/data/com.termux/files/home'))) {
          const termuxHome = '/data/data/com.termux/files/home';
          const cwd = process.cwd();
          const parentFolderName = path.basename(cwd) || 'Github-devy';
          wDir = path.join(termuxHome, parentFolderName, '.agent_workspace', finalWorkspaceId);
          console.log(`Retrying workspace initialization with normalized absolute path: ${wDir}`);
          attempt++;
        } else {
          // Re-throw if retry fails or it's a critical non-ENOENT error
          throw err;
        }
      }
    }

    const git = simpleGit(wDir);
    
    // Set Git env vars to block interactive prompts
    process.env.GIT_TERMINAL_PROMPT = '0';
    process.env.GIT_ASKPASS = 'true';
    process.env.SSH_ASKPASS = 'true';
    
    let authUrl = repoUrl;
    if (token && repoUrl.startsWith('https://')) {
      const urlObj = new URL(repoUrl);
      authUrl = `https://${token}@${urlObj.host}${urlObj.pathname}`;
    }

    // Wrap remote clone with a timeout
    await withTimeout(
      git.clone(authUrl, '.', ['--depth', '1', '--recurse-submodules', '--shallow-submodules']),
      60000,
      'Git clone timed out after 60 seconds. Please make sure the repository is public or your access token is valid.'
    );

    // Configure default dummy user for commits if needed
    await git.addConfig('user.name', 'Agent CLI');
    await git.addConfig('user.email', 'agent@cli.local');

    res.json({ success: true, message: 'Repository loaded successfully', workspaceId: finalWorkspaceId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/commit', async (req, res) => {
  try {
    const { message, workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);
    await git.add('.');
    await git.commit(message || 'Agent commit');
    await git.push();
    res.json({ success: true, message: 'Changes committed and pushed.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/status', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      return res.json({ isRepository: false, files: [] });
    }

    const status = await git.status();
    const files = status.files.map(f => {
      let state = 'modified';
      if (f.index === '?' || f.working_dir === '?') state = 'untracked';
      else if (f.index === 'A' || f.working_dir === 'A') state = 'added';
      else if (f.index === 'D' || f.working_dir === 'D') state = 'deleted';
      return {
        path: f.path,
        state
      };
    });

    const currentBranch = status.current || 'main';

    res.json({
      isRepository: true,
      currentBranch,
      files,
      ahead: status.ahead,
      behind: status.behind
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/diff', async (req, res) => {
  try {
    const { workspaceId, filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);

    let diff = '';
    try {
      diff = await git.diff([filePath]);
      if (!diff) {
        diff = await git.diff(['--cached', filePath]);
      }
    } catch {
      diff = 'Unable to get diff.';
    }

    res.json({ success: true, diff });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/push', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);
    await git.push();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pull', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);
    const result = await git.pull();
    res.json({ success: true, summary: result.summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/init', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, '.');
    const git = simpleGit(wDir);
    await git.init();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
