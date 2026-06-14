import express from 'express';
import cors from 'cors';
import path from 'path';
import http from 'http';

// Import Route Handlers
import aiRouter from './server/routes/ai';
import browserRouter, { relativeAssetProxyCatcher, registerProxyRoutes } from './server/routes/browser';
import fsRouter from './server/routes/fs';
import gitRouter from './server/routes/git';
import workspaceRouter from './server/routes/workspace';
import cmdRouter from './server/routes/cmd';
import webRouter from './server/routes/web';
import dbRouter from './server/routes/db';
import debugRouter from './server/routes/debug';
import packageRouter from './server/routes/package';

// Import Websocket handlers
import { setupWebSocketTerminal } from './server/websocket/terminal';

const app = express();
const PORT = 3000;

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

  const server = http.createServer(app);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // Setup terminal websocket connections
  setupWebSocketTerminal(server);
}

startServer();
