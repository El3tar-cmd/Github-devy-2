import { Router } from 'express';
import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { safePath, getWorkspaceDir, withTimeout } from '../utils/workspace';
import { execFile } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execFileAsync = promisify(execFile);
const GITHUB_API = 'https://api.github.com';

// Prevent Git commands inside workspaces from traversing up to the IDE's own Git repo
process.env.GIT_CEILING_DIRECTORIES = path.resolve(process.cwd());

// Configure git globally to treat all directories under the workspace as safe (resolves Termux/Android ownership issues)
import { exec } from 'child_process';
try {
  exec("git config --global --add safe.directory '*'", (err: any) => {
    if (err) console.warn("Failed to set git safe.directory globally:", err);
  });
} catch (_) {}

async function runGit(workspaceId: string, args: string[], timeoutMs = 60000) {
  const { wDir } = await safePath(workspaceId, '.');
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: wDir,
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 8,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'true',
      SSH_ASKPASS: 'true',
    },
  });
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

function parseGithubRemote(remoteUrl: string) {
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/(.+)$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'github.com') return null;
    const [owner, repo] = url.pathname.replace(/^\/+/, '').split('/');
    return owner && repo ? { owner, repo } : null;
  } catch {
    return null;
  }
}

async function resolveGithubRepo(workspaceId: string, owner?: string, repo?: string) {
  if (owner && repo) return { owner, repo };
  const remote = await runGit(workspaceId, ['remote', 'get-url', 'origin']);
  const parsed = parseGithubRemote(remote.stdout);
  if (!parsed) throw new Error('Could not infer GitHub owner/repo from origin remote. Provide owner and repo.');
  return parsed;
}

function githubHeaders(token?: string) {
  const finalToken = token || process.env.GITHUB_TOKEN || '';
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(finalToken ? { Authorization: `Bearer ${finalToken}` } : {}),
  };
}

async function githubRequest(apiPath: string, token?: string, init: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${apiPath}`, {
    ...init,
    headers: {
      ...githubHeaders(token),
      ...(init.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok) {
    const message = contentType.includes('application/json')
      ? JSON.stringify(await res.json())
      : await res.text();
    throw new Error(`GitHub API ${res.status}: ${message}`);
  }

  if (contentType.includes('application/json')) return res.json();
  return res;
}

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

router.post('/history', async (req, res) => {
  try {
    const { workspaceId, limit = 30 } = req.body;
    const count = Math.min(Math.max(Number(limit) || 30, 1), 200);
    const result = await runGit(workspaceId, [
      'log',
      `-${count}`,
      '--date=iso',
      '--pretty=format:%H%x09%h%x09%an%x09%ad%x09%s',
    ]);
    const commits = result.stdout ? result.stdout.split('\n').map(line => {
      const [hash, shortHash, author, date, ...subjectParts] = line.split('\t');
      return { hash, shortHash, author, date, subject: subjectParts.join('\t') };
    }) : [];
    res.json({ success: true, commits });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/branches', async (req, res) => {
  try {
    const { workspaceId, includeRemote = true } = req.body;
    const args = ['branch', '--format=%(refname:short)%09%(HEAD)%09%(upstream:short)'];
    if (includeRemote) args.splice(1, 0, '--all');
    const result = await runGit(workspaceId, args);
    const branches = result.stdout ? result.stdout.split('\n').map(line => {
      const [name, head, upstream] = line.split('\t');
      return { name, current: head === '*', upstream: upstream || null };
    }) : [];
    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { workspaceId, branch, create = false, startPoint } = req.body;
    if (!branch) return res.status(400).json({ error: 'branch required' });
    const args = create
      ? ['checkout', '-b', branch, ...(startPoint ? [startPoint] : [])]
      : ['checkout', branch];
    const result = await runGit(workspaceId, args);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    const { workspaceId, remote = 'origin', prune = true } = req.body;
    const result = await runGit(workspaceId, ['fetch', ...(prune ? ['--prune'] : []), remote], 120000);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/merge', async (req, res) => {
  try {
    const { workspaceId, ref, noFf = false } = req.body;
    if (!ref) return res.status(400).json({ error: 'ref required' });
    const result = await runGit(workspaceId, ['merge', ...(noFf ? ['--no-ff'] : []), ref]);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/remotes', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    const result = await runGit(workspaceId, ['remote', '-v']);
    const remotes = result.stdout ? result.stdout.split('\n').map(line => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      return match ? { name: match[1], url: match[2], type: match[3] } : { raw: line };
    }) : [];
    res.json({ success: true, remotes });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/remote', async (req, res) => {
  try {
    const { workspaceId, action, name = 'origin', url } = req.body;
    if (!['add', 'set-url', 'remove'].includes(action)) {
      return res.status(400).json({ error: 'action must be add, set-url, or remove' });
    }
    if (action !== 'remove' && !url) return res.status(400).json({ error: 'url required' });
    const args = action === 'remove'
      ? ['remote', 'remove', name]
      : ['remote', action, name, url];
    const result = await runGit(workspaceId, args);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stash', async (req, res) => {
  try {
    const { workspaceId, action = 'list', message, stashRef } = req.body;
    const allowed = ['list', 'push', 'pop', 'apply', 'drop'];
    if (!allowed.includes(action)) return res.status(400).json({ error: `action must be one of ${allowed.join(', ')}` });
    const args = ['stash', action];
    if (action === 'push') args.push('-u', '-m', message || 'Agent stash');
    if (['pop', 'apply', 'drop'].includes(action) && stashRef) args.push(stashRef);
    const result = await runGit(workspaceId, args);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/tags', async (req, res) => {
  try {
    const { workspaceId, action = 'list', name, message, ref } = req.body;
    let args: string[];
    if (action === 'list') {
      args = ['tag', '--list'];
    } else if (action === 'create') {
      if (!name) return res.status(400).json({ error: 'name required' });
      args = message ? ['tag', '-a', name, '-m', message, ...(ref ? [ref] : [])] : ['tag', name, ...(ref ? [ref] : [])];
    } else if (action === 'delete') {
      if (!name) return res.status(400).json({ error: 'name required' });
      args = ['tag', '-d', name];
    } else {
      return res.status(400).json({ error: 'action must be list, create, or delete' });
    }
    const result = await runGit(workspaceId, args);
    res.json({ success: true, output: result.stdout || result.stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/runs', async (req, res) => {
  try {
    const { workspaceId, owner, repo, branch, workflowId, limit = 20, token } = req.body;
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const params = new URLSearchParams();
    if (branch) params.set('branch', branch);
    params.set('per_page', String(Math.min(Math.max(Number(limit) || 20, 1), 100)));
    const pathPrefix = workflowId
      ? `/repos/${target.owner}/${target.repo}/actions/workflows/${workflowId}/runs`
      : `/repos/${target.owner}/${target.repo}/actions/runs`;
    const data = await githubRequest(`${pathPrefix}?${params.toString()}`, token);
    res.json({ success: true, repository: target, runs: data.workflow_runs || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/run', async (req, res) => {
  try {
    const { workspaceId, owner, repo, runId, token } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId required' });
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const run = await githubRequest(`/repos/${target.owner}/${target.repo}/actions/runs/${runId}`, token);
    res.json({ success: true, repository: target, run });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/jobs', async (req, res) => {
  try {
    const { workspaceId, owner, repo, runId, token } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId required' });
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const data = await githubRequest(`/repos/${target.owner}/${target.repo}/actions/runs/${runId}/jobs?per_page=100`, token);
    res.json({ success: true, repository: target, jobs: data.jobs || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/logs', async (req, res) => {
  try {
    const { workspaceId, owner, repo, runId, jobId, token } = req.body;
    if (!runId && !jobId) return res.status(400).json({ error: 'runId or jobId required' });
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const apiPath = jobId
      ? `/repos/${target.owner}/${target.repo}/actions/jobs/${jobId}/logs`
      : `/repos/${target.owner}/${target.repo}/actions/runs/${runId}/logs`;
    const response = await githubRequest(apiPath, token);
    const contentType = response.headers.get('content-type') || 'text/plain';
    const text = await response.text();
    res.json({ success: true, repository: target, contentType, logs: text.slice(0, 200000), truncated: text.length > 200000 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/artifacts', async (req, res) => {
  try {
    const { workspaceId, owner, repo, runId, token } = req.body;
    if (!runId) return res.status(400).json({ error: 'runId required' });
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const data = await githubRequest(`/repos/${target.owner}/${target.repo}/actions/runs/${runId}/artifacts?per_page=100`, token);
    res.json({ success: true, repository: target, artifacts: data.artifacts || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/download-artifact', async (req, res) => {
  try {
    const { workspaceId, owner, repo, artifactId, token, fileName } = req.body;
    if (!artifactId) return res.status(400).json({ error: 'artifactId required' });
    const target = await resolveGithubRepo(workspaceId, owner, repo);
    const response = await githubRequest(`/repos/${target.owner}/${target.repo}/actions/artifacts/${artifactId}/zip`, token);
    const bytes = Buffer.from(await response.arrayBuffer());
    const { resolved } = await safePath(workspaceId, path.join('.github-devy', 'artifacts'));
    await fs.mkdir(resolved, { recursive: true });
    const outputName = (fileName || `artifact-${artifactId}.zip`).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const outputPath = path.join(resolved, outputName.endsWith('.zip') ? outputName : `${outputName}.zip`);
    await fs.writeFile(outputPath, bytes);
    res.json({ success: true, repository: target, path: path.relative((await safePath(workspaceId, '.')).wDir, outputPath), bytes: bytes.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
