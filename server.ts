import express from 'express';
import cors from 'cors';
import { simpleGit } from 'simple-git';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { WebSocketServer } from 'ws';
import http from 'http';

const execAsync = promisify(exec);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Browser Actions Data Structures
interface BrowserAction {
  id: string;
  type: 'click' | 'type' | 'navigate' | 'refresh' | 'get-html';
  selector?: string;
  text?: string;
  url?: string;
}

let pendingActions: BrowserAction[] = [];
const actionResults: { [actionId: string]: { success: boolean; url: string; html?: string; error?: string } } = {};
let lastKnownBrowserState = { url: '', html: '', active: false };

const isIdeRoute = (url: string) => {
  return url.startsWith('/api/browser') ||
         url.startsWith('/api/git') ||
         url.startsWith('/api/fs') ||
         url.startsWith('/api/cmd') ||
         url.startsWith('/api/web') ||
         url.startsWith('/api/workspace') ||
         url.startsWith('/api/gemini') ||
         url === '/api/workspaces';
};

// 1. Relative Asset Proxy Catcher Middleware
app.use((req, res, next) => {
  if (req.url.startsWith('/proxy') || isIdeRoute(req.url)) {
    return next();
  }

  let portStr: string | null = null;
  
  // Try extracting local port from referer
  const referer = req.headers.referer;
  if (referer) {
    const match = referer.match(/\/proxy\/(\d+)/);
    if (match) {
      portStr = match[1];
    }
  }

  // Safe Fallback to cookie
  // We ONLY fallback to cookie if there is NO referer or if the referer is indeed a proxied page.
  // We MUST NEVER fallback to cookie for paths belonging to the main IDE (lest we hijack IDE's own assets and break the UI).
  if (!portStr && req.headers.cookie) {
    const hasReferer = !!referer;
    const refererHasProxy = referer && referer.includes('/proxy/');
    
    // If there is a referer, but it doesn't have /proxy/, it is from the main IDE itself. Do not proxy!
    if (!hasReferer || refererHasProxy) {
      // Avoid hijacking the root, index, and Vite/HMR asset folders of the main IDE
      const isIdeAsset = req.url === '/' ||
                         req.url.startsWith('/index.html') ||
                         req.url.startsWith('/src/') ||
                         req.url.startsWith('/node_modules/') ||
                         req.url.startsWith('/@id/') ||
                         req.url.startsWith('/@vite/') ||
                         req.url.startsWith('/@fs/') ||
                         req.url.startsWith('/@react-refresh') ||
                         req.url.includes('vite.svg');
      
      if (!isIdeAsset) {
        const match = req.headers.cookie.match(/last_proxy_port=(\d+)/);
        if (match) {
          portStr = match[1];
        }
      }
    }
  }

  if (portStr) {
    const port = parseInt(portStr, 10);
    // Safety check: Avoid routing to the main IDE port 3000 to prevent infinite loops
    if (!isNaN(port) && port !== 3000) {
      const options = {
        host: '127.0.0.1',
        port: port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers }
      };

      if (options.headers) {
        delete options.headers.host;
        delete options.headers.referer;
      }

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', () => {
        res.status(404).end();
      });

      req.pipe(proxyReq);
      return;
    }
  }

  next();
});

// 2. Explicit /proxy/:port Reverse Proxy Router
app.all('/proxy/:port*', (req, res) => {
  // Extract port and subpath directly from the request URL to avoid Express 4 parameter-shortening issues
  const match = req.url.match(/^\/proxy\/(\d+)(.*)/);
  if (!match) {
    return res.status(400).send('Invalid proxy URL');
  }

  const port = parseInt(match[1], 10);
  
  if (isNaN(port)) {
    return res.status(400).send('Invalid port');
  }

  // Save the subpath port in a session cookie
  res.cookie('last_proxy_port', String(port), { path: '/' });

  let subpath = match[2] || '/';
  
  const options = {
    host: '127.0.0.1',
    port: port,
    method: req.method,
    path: subpath,
    headers: { ...req.headers }
  };

  if (options.headers) {
    delete options.headers.host;
    delete options.headers.referer;
  }

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.status(502).send(`
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 32px; background: #0b0b0e; color: #fff; min-height: 100vh; display: flex; flex-col; justify-content: center; align-items: center;">
         <div style="max-width: 500px; padding: 24px; background: #121217; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <h1 style="color: #f87171; font-size: 20px; font-weight: 600; margin: 0 0 12px 0;">🔌 المطور المحلي غير متصل</h1>
            <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
               تأكد من تشغيل خادم التطبيق الخاص بك في الترمينال على المنفذ (Port) <strong>${port}</strong>.<br/>
               على سبيل المثال، قم بتشغيل <code>npm run dev</code> أو <code>python manage.py runserver</code> وتأكد من سماع الخادم هناك.
            </p>
            <div style="padding: 12px; background: #1a1a24; border-radius: 8px; font-family: monospace; font-size: 11px; color: #fbbf24; border: 1px solid rgba(255,255,255,0.02); word-break: break-all;">
               خطأ الاتصال: 127.0.0.1:${port} -> ${err.message}
            </div>
         </div>
      </div>
    `);
  });

  req.pipe(proxyReq);
});

// 3. Web Automation API for Agent and Preview Console
app.post('/api/browser/action', async (req, res) => {
  const { type, selector, text, url } = req.body;
  const actionId = Math.random().toString(36).substring(7);
  const action: BrowserAction = { id: actionId, type, selector, text, url };

  pendingActions.push(action);

  // Poll for client fulfillment (up to 15 seconds)
  let attempts = 0;
  const check = setInterval(() => {
    if (actionResults[actionId]) {
      clearInterval(check);
      const result = actionResults[actionId];
      res.json(result);
      delete actionResults[actionId];
    } else if (attempts > 150) { // 15 seconds
      clearInterval(check);
      pendingActions = pendingActions.filter(a => a.id !== actionId);
      res.status(408).json({ success: false, error: 'Web automation command timed out. Ensure your Sandbox Browser Preview pane inside the IDE is open and active.' });
    }
    attempts++;
  }, 100);
});

app.get('/api/browser/pending', (req, res) => {
  res.json({ actions: pendingActions });
  pendingActions = []; // Flush
});

app.post('/api/browser/result', (req, res) => {
  const { actionId, success, url, html, error } = req.body;
  actionResults[actionId] = { success, url, html, error };
  res.json({ success: true });
});

app.post('/api/browser/state', (req, res) => {
  const { url, html, active } = req.body;
  lastKnownBrowserState = { url, html, active: !!active };
  res.json({ success: true });
});

app.get('/api/browser/state', (req, res) => {
  res.json(lastKnownBrowserState);
});

const BASE_WORKSPACE_DIR = path.resolve(process.cwd(), '.agent_workspace');

// Helper to get workspace directory based on ID
function getWorkspaceDir(id?: string) {
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
async function initWorkspace(id: string) {
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
async function safePath(id: string, subPath: string) {
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
function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeout]);
}

app.post('/api/gemini/generate', async (req, res) => {
  try {
    const { model, payload, clientApiKey } = req.body;
    
    // Use server side env variable or fallback to manually inputted client key
    const apiKey = process.env.GEMINI_API_KEY || clientApiKey;
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API Key missing. Please add GEMINI_API_KEY inside the Secrets panel of AI Studio.' });
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(apiRes.status).json({ error: `Gemini API Error: ${errText}` });
    }
    
    const data = await apiRes.json();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/clone', async (req, res) => {
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

app.post('/api/fs/read', async (req, res) => {
  try {
    const { path: filePath, workspaceId } = req.body;
    const { resolved } = await safePath(workspaceId, filePath);
    const content = await fs.readFile(resolved, 'utf8');
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/write', async (req, res) => {
  try {
    const { path: filePath, content, workspaceId } = req.body;
    const { resolved } = await safePath(workspaceId, filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf8');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/replace', async (req, res) => {
  try {
    const { path: filePath, search, replace, workspaceId } = req.body;
    const { resolved } = await safePath(workspaceId, filePath);
    let content = await fs.readFile(resolved, 'utf8');
    if (!content.includes(search)) {
      return res.status(400).json({ error: 'Search string not found in file.' });
    }
    content = content.replace(search, replace);
    await fs.writeFile(resolved, content, 'utf8');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/mkdir', async (req, res) => {
  try {
    const { path: dirPath, workspaceId } = req.body;
    const { resolved } = await safePath(workspaceId, dirPath);
    await fs.mkdir(resolved, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/rename', async (req, res) => {
  try {
    const { oldPath, newPath, workspaceId } = req.body;
    const { resolved: resolvedOld } = await safePath(workspaceId, oldPath);
    const { resolved: resolvedNew } = await safePath(workspaceId, newPath);
    await fs.rename(resolvedOld, resolvedNew);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/delete', async (req, res) => {
  try {
    const { path: targetPath, workspaceId } = req.body;
    const { resolved } = await safePath(workspaceId, targetPath);
    await fs.rm(resolved, { recursive: true, force: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workspace/delete', async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });
    const dir = getWorkspaceDir(workspaceId);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/search', async (req, res) => {
  try {
    const { pattern, directory = '.', workspaceId } = req.body;
    const { wDir } = await safePath(workspaceId, directory);
    // Use grep to search, excluding large generated or lock/cache directories
    const ignoredDirs = ['.git', 'node_modules', '.chromium-profile', '.npm', '.cache', 'dist', 'build', 'out', 'venv', '.venv', '__pycache__'];
    const excludeFlags = ignoredDirs.map(d => `--exclude-dir="${d}"`).join(' ');
    
    const { stdout } = await execAsync(`grep -rnI ${excludeFlags} "${pattern.replace(/"/g, '\\"')}" .`, { cwd: wDir });
    res.json({ matches: stdout });
  } catch (error: any) {
    // grep returns exit code 1 if no matches found
    if (error.code === 1) {
      res.json({ matches: 'No matches found.' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.post('/api/cmd/run', async (req, res) => {
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

app.post('/api/web/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });

    let results: { title: string; snippet: string; url?: string }[] = [];

    // Fallback 1: DuckDuckGo HTML selector parsing
    try {
      const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (resp.ok) {
        const html = await resp.text();
        const $ = cheerio.load(html);

        $('.web-result, .result, .result__body').each((i, el) => {
          const titleEl = $(el).find('.result__title, .result-link, a');
          const title = titleEl.text().trim();
          const href = titleEl.attr('href');
          const snippet = $(el).find('.result__snippet, .result-snippet, .result__body').text().trim();
          if (title && snippet) {
            results.push({ title, snippet, url: href });
          }
        });
      }
    } catch (e) {
      console.error('DDG HTML search error:', e);
    }

    // Fallback 2: DuckDuckGo Lite version (more stable layout, POST format)
    if (results.length === 0) {
      try {
        const resp = await fetch('https://lite.duckduckgo.com/lite/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: `q=${encodeURIComponent(query)}`
        });
        if (resp.ok) {
          const html = await resp.text();
          const $ = cheerio.load(html);
          
          $('td.result-snippet').each((i, el) => {
            const table = $(el).closest('table');
            const titleEl = table.find('.result-link');
            const title = titleEl.text().trim();
            const href = titleEl.attr('href');
            const snippet = $(el).text().trim();
            if (title && snippet) {
              results.push({ title, snippet, url: href });
            }
          });
        }
      } catch (e) {
        console.error('DDG Lite search error:', e);
      }
    }

    // Format the results
    const formatted = results.map(r => {
      let segment = `### ${r.title}\n${r.snippet}`;
      if (r.url) segment += `\n*Source: ${r.url}*`;
      return segment;
    }).slice(0, 10).join('\n\n');

    res.json({ results: formatted.substring(0, 4000) || 'No results found. Please try a different query or use Google Search grounding.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/web/browse', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    let targetUrl = url;
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!resp.ok) {
      throw new Error(`Failed to fetch web page: HTTP status ${resp.status}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    // Remove scripts, styles, layouts, sidebars
    $('script, style, nav, footer, header, iframe, link, meta, noscript, aside').remove();

    const textBlocks: string[] = [];
    $('h1, h2, h3, h4, h5, h6, p, ul li, ol li, article').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10) {
        textBlocks.push(text);
      }
    });

    let mainText = textBlocks.join('\n\n');
    if (mainText.length < 50) {
      // Fallback to plain body
      mainText = $('body').text().replace(/\s+/g, ' ').trim();
    }

    res.json({ content: mainText.substring(0, 5000) || 'No readable text content found on the page.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/commit', async (req, res) => {
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

app.get('/api/workspaces', async (req, res) => {
  try {
    await fs.mkdir(BASE_WORKSPACE_DIR, { recursive: true });
    const entries = await fs.readdir(BASE_WORKSPACE_DIR, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    res.json({ workspaces: dirs });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/list', async (req, res) => {
  try {
    const { path: dirPath = '.', workspaceId } = req.body;
    
    let wDir;
    try {
      wDir = getWorkspaceDir(workspaceId);
    } catch {
      return res.json({ files: [] });
    }

    try {
      await fs.access(wDir);
    } catch {
      return res.json({ files: [] });
    }

    const { resolved } = await safePath(workspaceId, dirPath);
    try {
      await fs.access(resolved);
    } catch {
      return res.json({ files: [] });
    }
    
    // Recursive directory read
    async function walk(dir: string, baseDir: string): Promise<any[]> {
      try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        let result: any[] = [];
        const ignoredDirs = ['.git', 'node_modules', '.chromium-profile', '.npm', '.cache', 'dist', 'build', 'out', 'venv', '.venv', '__pycache__'];
        for (const f of files) {
          if (ignoredDirs.includes(f.name)) continue;
          const fullPath = path.join(dir, f.name);
          const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
          if (f.isDirectory()) {
            let ch: any[] = [];
            try {
              ch = await walk(fullPath, baseDir);
            } catch (e) {}
            result.push({ path: relPath, name: f.name, isDirectory: true, children: ch });
          } else {
            result.push({ path: relPath, name: f.name, isDirectory: false });
          }
        }
        return result;
      } catch (err) {
        return [];
      }
    }
    
    let tree: any[] = [];
    try {
      tree = await walk(resolved, resolved);
    } catch (e) {}
    res.json({ files: tree });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Setup Vite for Dev / Static files for Prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });

  const wss = new WebSocketServer({ server });
  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const workspaceId = url.searchParams.get('workspaceId');
      if (!workspaceId) {
        ws.close();
        return;
      }
      
      let wDir;
      try {
        wDir = (await safePath(workspaceId, '.')).wDir;
        await fs.mkdir(wDir, { recursive: true });
      } catch (e) {
        try {
          ws.send('\r\nError: Invalid or inaccessible workspace directory.\r\n');
        } catch (_) {}
        ws.close();
        return;
      }

      let selectedShell = 'sh';
      if (existsSync('/bin/bash')) {
        selectedShell = '/bin/bash';
      } else if (existsSync('/bin/sh')) {
        selectedShell = '/bin/sh';
      }

      const bash = spawn(selectedShell, [], { 
        env: { 
          ...process.env, 
          TERM: 'xterm-256color',
          PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
        }, 
        cwd: wDir 
      });
      
      bash.on('error', (err) => {
        console.error('Terminal process error:', err);
        try {
          ws.send(`\r\nError starting terminal: ${err.message}\r\n`);
        } catch (_) {}
        ws.close();
      });

      if (bash.stdout) {
        bash.stdout.on('error', (err) => {
          console.error('Terminal stdout error:', err);
        });
        bash.stdout.on('data', (data) => {
          try { ws.send(data); } catch (_) {}
        });
      }

      if (bash.stderr) {
        bash.stderr.on('error', (err) => {
          console.error('Terminal stderr error:', err);
        });
        bash.stderr.on('data', (data) => {
          try { ws.send(data); } catch (_) {}
        });
      }

      if (bash.stdin) {
        bash.stdin.on('error', (err) => {
          console.error('Terminal stdin error:', err);
        });
      }

      bash.on('close', () => {
        try { ws.close(); } catch (_) {}
      });

      ws.on('message', (msg) => {
        try {
          if (bash.stdin && bash.stdin.writable) {
            bash.stdin.write(msg);
          }
        } catch (_) {}
      });

      ws.on('close', () => {
        try {
          if (bash.pid && !bash.killed) {
            bash.kill();
          }
        } catch (_) {}
      });
    } catch (wsErr: any) {
      console.error('WebSocket terminal connection setup error:', wsErr);
      try { ws.close(); } catch (_) {}
    }
  });
}

startServer();
