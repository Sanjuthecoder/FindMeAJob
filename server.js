const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const portArg = process.argv.slice(2).find(arg => !arg.startsWith('--') && !isNaN(parseInt(arg, 10)));
const PORT = parseInt(process.env.PORT || portArg || '3000', 10);
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL & remove query params
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // API Proxy for RemoteOK to bypass browser CORS restrictions
  if (pathname === '/api/remoteok') {
    handleRemoteOKProxy(req, res, parsedUrl.search);
    return;
  }

  if (pathname === '/api/remotive') {
    handleRemotiveProxy(req, res, parsedUrl.search);
    return;
  }

  if (pathname === '/api/adzuna') {
    handleAdzunaProxy(req, res, parsedUrl.search);
    return;
  }

  // Friendly route aliases
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  } else if (pathname === '/results') {
    pathname = '/results.html';
  } else if (pathname === '/tests') {
    pathname = '/tests/runner.html';
  }

  // Safe file path resolution (prevent path traversal)
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(ROOT, safePath);

  // If pointing to a directory, look for index.html inside
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If file doesn't exist, try appending .html
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 Not Found</title><style>body{font-family:sans-serif;background:#0d1117;color:#c9d1d9;padding:40px;text-align:center;}a{color:#58a6ff;text-decoration:none;}</style></head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>Cannot find <code>${pathname}</code></p>
          <p><a href="/">Return to Home</a></p>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// In-memory caches to minimize remote latency and rate-limits
let remoteOKCache = new Map();
let remotiveCache = new Map();
let adzunaCache   = new Map();

async function handleRemoteOKProxy(req, res, searchStr) {
  const targetUrl = `https://remoteok.com/api${searchStr || ''}`;
  const now = Date.now();
  const cached = remoteOKCache.get(targetUrl);
  if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Cache': 'HIT',
    });
    res.end(cached.data);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const apiRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (!apiRes.ok) {
      throw new Error(`RemoteOK returned HTTP ${apiRes.status}`);
    }

    const jsonText = await apiRes.text();
    remoteOKCache.set(targetUrl, { data: jsonText, timestamp: now });

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Cache': 'MISS',
    });
    res.end(jsonText);
  } catch (err) {
    console.error('[Server] RemoteOK proxy error:', err.message);
    if (cached) {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Cache': 'STALE',
      });
      res.end(cached.data);
      return;
    }
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Failed to fetch from RemoteOK', message: err.message }));
  }
}

async function handleRemotiveProxy(req, res, searchStr) {
  const targetUrl = `https://remotive.com/api/remote-jobs${searchStr || ''}`;
  const now = Date.now();
  const cached = remotiveCache.get(targetUrl);
  if (cached && (now - cached.timestamp < 10 * 60 * 1000)) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' });
    res.end(cached.data);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const apiRes = await fetch(targetUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!apiRes.ok) throw new Error(`Remotive returned HTTP ${apiRes.status}`);
    const jsonText = await apiRes.text();
    remotiveCache.set(targetUrl, { data: jsonText, timestamp: now });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' });
    res.end(jsonText);
  } catch (err) {
    console.error('[Server] Remotive proxy error:', err.message);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'STALE' });
      res.end(cached.data);
      return;
    }
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Failed to fetch from Remotive', message: err.message }));
  }
}

async function handleAdzunaProxy(req, res, searchStr) {
  const targetUrl = `https://api.adzuna.com/v1/api/jobs/in/search/1${searchStr || ''}`;
  const now = Date.now();
  const cached = adzunaCache.get(targetUrl);
  if (cached && (now - cached.timestamp < 15 * 60 * 1000)) { // 15-minute cache preserves daily quota
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'HIT' });
    res.end(cached.data);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const apiRes = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeout);
    if (!apiRes.ok) throw new Error(`Adzuna returned HTTP ${apiRes.status}`);
    const jsonText = await apiRes.text();
    adzunaCache.set(targetUrl, { data: jsonText, timestamp: now });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'MISS' });
    res.end(jsonText);
  } catch (err) {
    console.error('[Server] Adzuna proxy error:', err.message);
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'X-Cache': 'STALE' });
      res.end(cached.data);
      return;
    }
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Failed to fetch from Adzuna', message: err.message }));
  }
}

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n==================================================`);
  console.log(`  FindMeAJob is running!`);
  console.log(`  URL: ${url}`);
  console.log(`  Tests: ${url}/tests/runner.html`);
  console.log(`==================================================\n`);

  // Open browser if requested via CLI flag --open or OPEN_BROWSER env
  if (process.argv.includes('--open') || process.env.OPEN_BROWSER === 'true') {
    const startCmd = process.platform === 'win32' ? `start "" "${url}"` :
                     process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(startCmd);
  }
});
