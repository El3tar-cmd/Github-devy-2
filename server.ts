import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';
import fs from 'fs';

// Import Route Handlers
import aiRouter from './server/routes/ai';
import browserRouter, { relativeAssetProxyCatcher, registerProxyRoutes } from './server/routes/browser';
import fsRouter from './server/routes/fs';
import gitRouter from './server/routes/git';
import workspaceRouter from './server/routes/workspace';
import cmdRouter, { killAllBackgroundProcesses } from './server/routes/cmd';
import webRouter from './server/routes/web';
import dbRouter from './server/routes/db';
import debugRouter from './server/routes/debug';
import packageRouter from './server/routes/package';
import ragRouter from './server/routes/rag';
import astRouter from './server/routes/ast';
import sandboxRouter from './server/routes/sandbox';


// Import Websocket handlers
import { setupWebSocketTerminal, cleanAllTerminalSessions } from './server/websocket/terminal';

const app = express();
const PORT = parseInt(process.env.PORT || '9876');
let serverInstance: http.Server | null = null;
const isProductionServer = process.env.NODE_ENV === 'production' || process.argv[1]?.endsWith(path.join('dist', 'server.cjs'));

// Prevent Git commands inside workspaces from traversing up to the IDE's own Git repo
process.env.GIT_CEILING_DIRECTORIES = path.resolve(process.cwd());

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Relative Asset Proxy Catcher Middleware
app.use(relativeAssetProxyCatcher);

// 2. Register explicit reverse proxy and service worker routes
registerProxyRoutes(app);

// 3. API Routers
app.use('/api/gemini', aiRouter);
app.use('/api/browser', browserRouter);
app.use('/api/fs', fsRouter);
app.use('/api/git', gitRouter);
app.use('/api', workspaceRouter); // Workspace endpoints and list workspaces (/api/workspaces)
app.use('/api/cmd', cmdRouter);
app.use('/api/web', webRouter);
app.use('/api/db', dbRouter);
app.use('/api/debug', debugRouter);
app.use('/api/package', packageRouter);
app.use('/api/rag', ragRouter);
app.use('/api/ast', astRouter);
app.use('/api/sandbox', sandboxRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});


// Setup Vite for Dev / Static files for Prod
async function startServer() {
  app.get('/docs', (req, res) => {
    res.sendFile(path.resolve('docs/docs.html'));
  });

  // Serve documentation files
  app.get('/docs/:file', (req, res) => {
    const fileName = req.params.file;
    const filePath = path.resolve('docs', fileName);
    
    // Security check: prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^\.\.\//, '');
    const resolvedPath = path.resolve('docs', safePath);
    
    if (!resolvedPath.startsWith(path.resolve('docs'))) {
      return res.status(403).send('Access denied');
    }
    
    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
      res.sendFile(resolvedPath);
    } else {
      res.status(404).send('Documentation file not found');
    }
  });

  if (!isProductionServer) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.use('*', (req, res) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  const server = http.createServer(app);
  serverInstance = server;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // Setup terminal websocket connections
  setupWebSocketTerminal(server);
}

// Clean shutdown handlers to kill all child processes and release ports
function handleShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting clean shutdown...`);
  
  try {
    cleanAllTerminalSessions();
    console.log('✓ Cleaned all terminal sessions.');
  } catch (err) {
    console.error('Error cleaning terminal sessions:', err);
  }

  try {
    killAllBackgroundProcesses();
    console.log('✓ Killed all background processes.');
  } catch (err) {
    console.error('Error killing background processes:', err);
  }

  if (serverInstance) {
    serverInstance.close(() => {
      console.log('✓ HTTP server closed.');
      process.exit(0);
    });
    // Force exit after 5 seconds if server won't close
    setTimeout(() => process.exit(0), 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer();
