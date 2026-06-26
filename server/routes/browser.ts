import { Router, Request, Response, NextFunction, Express } from 'express';
import http from 'http';
import * as cheerio from 'cheerio';
import { notifyBrowserPending } from '../websocket/events';

const router = Router();

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

function rewriteHtmlForProxy(html: string, port: number): string {
  try {
    const $ = cheerio.load(html);

    // 1. Ensure base href pointing to proxy subpath
    $('base').remove();
    const baseTag = `<base href="/proxy/${port}/" />`;
    if ($('head').length > 0) {
      $('head').prepend(baseTag);
    } else {
      $('html').prepend(`<head>${baseTag}</head>`);
    }

    // 2. Rewrite attributes that reference absolute paths
    const attributesToRewrite = ['src', 'href', 'action', 'poster'];
    for (const attr of attributesToRewrite) {
      $(`[${attr}]`).each((_, el) => {
        let val = $(el).attr(attr);
        if (val && val.startsWith('/') && !val.startsWith('//') && !val.startsWith(`/proxy/${port}`)) {
          $(el).attr(attr, `/proxy/${port}${val}`);
        }
      });
    }

    // 3. Inject client-side path and API intercepter helper script
    const clientScript = `
    <!-- DEV_SITE_PROXY HELPER -->
    <script id="proxy-client-helper">
      (function() {
        const notifyParent = () => {
          try {
            window.parent.postMessage({ type: 'PREVIEW_URL_CHANGED', url: window.location.href }, '*');
          } catch(e){}
        };

        // Notify on initial load
        notifyParent();

        window.addEventListener('popstate', notifyParent);
        window.addEventListener('hashchange', notifyParent);

        // Intercept client-side routing state changes
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, unused, url) {
          if (url && typeof url === 'string') {
            if (url.startsWith('/') && !url.startsWith('/proxy/')) {
              url = '/proxy/${port}' + url;
            }
          }
          const res = originalPushState.call(history, state, unused, url);
          notifyParent();
          return res;
        };
        
        history.replaceState = function(state, unused, url) {
          if (url && typeof url === 'string') {
            if (url.startsWith('/') && !url.startsWith('/proxy/')) {
              url = '/proxy/${port}' + url;
            }
          }
          const res = originalReplaceState.call(history, state, unused, url);
          notifyParent();
          return res;
        };

        // Intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          if (typeof url === 'string' && url.startsWith('/') && !url.startsWith('/proxy/')) {
            url = '/proxy/${port}' + url;
          }
          return originalOpen.call(this, method, url, ...args);
        };

        // Intercept Fetch API calls
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          if (typeof input === 'string') {
            if (input.startsWith('/') && !input.startsWith('/proxy/')) {
              input = '/proxy/${port}' + input;
            }
          } else if (input instanceof Request) {
            const url = input.url;
            const origin = window.location.origin;
            if (url.startsWith(origin) && !url.includes('/proxy/')) {
              const path = url.substring(origin.length);
              if (path.startsWith('/') && !path.startsWith('/proxy/')) {
                const newUrl = origin + '/proxy/${port}' + path;
                input = new Request(newUrl, input);
              }
            }
          }
          return originalFetch.call(window, input, init);
        };

        // Register Service Worker for robust absolute asset proxying
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/proxy-sw.js', { scope: '/proxy/' }).then(function(reg) {
            console.log('Service Worker registered with scope:', reg.scope);
            if (reg.active && !navigator.serviceWorker.controller) {
              window.location.reload();
            }
          }).catch(function(err) {
            console.error('Service Worker registration failed:', err);
          });
        }
      })();
    </script>
    `;

    if ($('head').length > 0) {
      $('head').append(clientScript);
    } else {
      $('html').append(clientScript);
    }

    return $.html();
  } catch (err) {
    console.error('Error rewriting HTML for proxy:', err);
    return html;
  }
}

// 1. Relative Asset Proxy Catcher Middleware
export function relativeAssetProxyCatcher(req: Request, res: Response, next: NextFunction) {
  if (req.url.startsWith('/proxy') || isIdeRoute(req.url)) {
    return next();
  }

  let portStr: string | null = null;
  
  // Try extracting local port from referer
  const referer = req.headers.referer;
  let refererHasProxy = false;
  if (referer) {
    const match = referer.match(/\/proxy\/(\d+)/);
    if (match) {
      portStr = match[1];
      refererHasProxy = true;
    }
  }

  // Safe Fallback to cookie
  if (!portStr && req.headers.cookie) {
    const isIdeAsset = req.url === '/' ||
                       req.url.startsWith('/index.html') ||
                       req.url.startsWith('/src/') ||
                       req.url.startsWith('/node_modules/') ||
                       req.url.startsWith('/@id/') ||
                       req.url.startsWith('/@vite/') ||
                       req.url.startsWith('/@fs/') ||
                       req.url.startsWith('/@react-refresh') ||
                       req.url.includes('vite.svg');
    
    const hasReferer = !!referer;
    if (!isIdeAsset && (!hasReferer || refererHasProxy || (referer && referer.includes('/src/')))) {
      const match = req.headers.cookie.match(/last_proxy_port=(\d+)/);
      if (match) {
        portStr = match[1];
      }
    }
  }

  if (portStr) {
    const port = parseInt(portStr, 10);
    // Safety check: Avoid routing to the main IDE port 9876 to prevent infinite loops, and ensure valid TCP port range
    if (!isNaN(port) && port >= 1 && port <= 65535 && port !== 9876) {
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
        delete options.headers['accept-encoding'];
      }

      const proxyReq = http.request(options, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        if (contentType.toLowerCase().startsWith('text/html')) {
          const headers = { ...proxyRes.headers };
          delete headers['content-length'];
          delete headers['content-encoding'];
          res.writeHead(proxyRes.statusCode || 200, headers);
          
          let chunks: Buffer[] = [];
          proxyRes.on('data', (chunk) => { chunks.push(chunk); });
          proxyRes.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf-8');
            res.end(rewriteHtmlForProxy(raw, port));
          });
        } else {
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', () => {
        res.status(404).end();
      });

      req.pipe(proxyReq);
      return;
    }
  }

  next();
}

// Function to register core proxy routes at root express app level
export function registerProxyRoutes(app: Express) {
  // Service Worker endpoint for the Browser Preview Iframe Proxy Interceptor
  app.get('/proxy-sw.js', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
      self.addEventListener('install', (event) => {
        self.skipWaiting();
      });

      self.addEventListener('activate', (event) => {
        event.waitUntil(self.clients.claim());
      });

      self.addEventListener('fetch', (event) => {
        const url = new URL(event.request.url);
        if (url.origin === self.location.origin) {
          const path = url.pathname;
          
          // Skip system-level paths and proxy-sw itself
          if (path.startsWith('/proxy/') || 
              path === '/proxy-sw.js' || 
              path === '/favicon.ico') {
            return;
          }

          event.respondWith((async () => {
            try {
              const client = await self.clients.get(event.clientId);
              if (client) {
                const clientUrl = new URL(client.url);
                const match = clientUrl.pathname.match(/^\\/proxy\\/(\\d+)/);
                if (match) {
                  const port = match[1];
                  const newUrl = \`\${self.location.origin}/proxy/\${port}\${path}\${url.search}\${url.hash}\`;
                  
                  const init = {
                    method: event.request.method,
                    headers: event.request.headers,
                    credentials: event.request.credentials,
                    cache: event.request.cache,
                    redirect: event.request.redirect,
                    referrer: event.request.referrer,
                    integrity: event.request.integrity,
                  };
                  
                  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
                    try {
                      init.body = await event.request.clone().arrayBuffer();
                    } catch (e) {
                      console.warn('Could not read request body for cloning:', e);
                    }
                  }
                  
                  return await fetch(new Request(newUrl, init));
                }
              }
            } catch (err) {
              console.error('Service Worker proxy interception error:', err);
            }
            return await fetch(event.request);
          })());
        }
      });
    `);
  });

  // Explicit /proxy/:port Reverse Proxy Router
  app.all('/proxy/:port*', (req: Request, res: Response) => {
    const match = req.url.match(/^\/proxy\/(\d+)(.*)/);
    if (!match) {
      return res.status(400).send('Invalid proxy URL');
    }

    const port = parseInt(match[1], 10);
    
    if (isNaN(port) || port < 1 || port > 65535) {
      return res.status(400).send('Invalid port. Must be between 1 and 65535.');
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
      delete options.headers['accept-encoding'];
    }

    const proxyReq = http.request(options, (proxyRes) => {
      const contentType = proxyRes.headers['content-type'] || '';
      if (contentType.toLowerCase().startsWith('text/html')) {
        const headers = { ...proxyRes.headers };
        delete headers['content-length'];
        delete headers['content-encoding'];
        res.writeHead(proxyRes.statusCode || 200, headers);
        
        let chunks: Buffer[] = [];
        proxyRes.on('data', (chunk) => { chunks.push(chunk); });
        proxyRes.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          res.end(rewriteHtmlForProxy(raw, port));
        });
      } else {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on('error', (err) => {
      res.status(502).send(`
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 32px; background: #0b0b0e; color: #fff; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
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
}

// APIs mounted at /api/browser
router.post('/action', async (req, res) => {
  const { type, selector, text, url } = req.body;
  const actionId = Math.random().toString(36).substring(7);
  const action: BrowserAction = { id: actionId, type, selector, text, url };

  pendingActions.push(action);
  notifyBrowserPending(action);

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

router.get('/pending', (req, res) => {
  res.json({ actions: pendingActions });
  pendingActions = []; // Flush
});

router.post('/result', (req, res) => {
  const { actionId, success, url, html, error } = req.body;
  actionResults[actionId] = { success, url, html, error };
  res.json({ success: true });
});

router.post('/state', (req, res) => {
  const { url, html, active } = req.body;
  lastKnownBrowserState = { url, html, active: !!active };
  res.json({ success: true });
});

router.get('/state', (req, res) => {
  res.json(lastKnownBrowserState);
});

export default router;
