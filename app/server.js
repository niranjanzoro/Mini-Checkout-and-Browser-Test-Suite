/**
 * server.js – minimal static-file server using Node's built-in `http` module only.
 *
 * Security model (defence in depth):
 *   1. Only GET and HEAD are accepted (405 + Allow header otherwise).
 *   2. The request path is percent-decoded inside try/catch (400 on malformed
 *      encoding) and rejected if it contains a null byte (400).
 *   3. The decoded path is resolved against ROOT and must stay inside it
 *      (path.resolve + ROOT + path.sep check, 403 otherwise).
 *   4. Only files in an explicit PUBLIC_FILES allow-list are served (404
 *      otherwise). server.js itself is therefore never exposed.
 *   5. The handler is wrapped so nothing can throw unhandled (500).
 *
 * Usage: node server.js [port]   (default 3000)
 */
'use strict';

const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');

const PORT = parseInt(process.env.PORT || process.argv[2] || '3000', 10);
const ROOT = __dirname;

// Explicit allow-list of publicly served files (relative to ROOT).
// Add assets here if the app ever gains separate CSS/JS/image files.
const PUBLIC_FILES = new Set(['index.html']);

const MIME = {
  '.html':        'text/html; charset=utf-8',
  '.css':         'text/css; charset=utf-8',
  '.js':          'application/javascript; charset=utf-8',
  '.ico':         'image/x-icon',
  '.png':         'image/png',
  '.svg':         'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, extraHeaders = {}, headOnly = false) {
  const payload = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': payload.length,
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(headOnly ? undefined : payload);
}

function handle(req, res) {
  // 1. Method check
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }
  const headOnly = req.method === 'HEAD';

  // 2. Decode the path safely
  const rawPath = (req.url || '/').split('?')[0].split('#')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    send(res, 400, 'Bad Request', {}, headOnly);
    return;
  }
  if (decoded.includes('\0')) {
    send(res, 400, 'Bad Request', {}, headOnly);
    return;
  }

  // 3. Resolve and keep inside ROOT
  const relPath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const absPath = path.resolve(ROOT, relPath);
  if (!absPath.startsWith(ROOT + path.sep)) {
    send(res, 403, 'Forbidden', {}, headOnly);
    return;
  }

  // 4. Explicit allow-list (compare using forward slashes)
  const publicName = path.relative(ROOT, absPath).split(path.sep).join('/');
  if (!PUBLIC_FILES.has(publicName)) {
    send(res, 404, 'Not Found', {}, headOnly);
    return;
  }

  // 5. Serve
  const ext = path.extname(absPath).toLowerCase();
  fs.readFile(absPath, (err, data) => {
    try {
      if (err) { send(res, 404, 'Not Found', {}, headOnly); return; }
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': data.length,
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(headOnly ? undefined : data);
    } catch (e) {
      console.error('Response error:', e);
      if (!res.headersSent) send(res, 500, 'Internal Server Error');
      else res.destroy();
    }
  });
}

const server = http.createServer((req, res) => {
  try {
    handle(req, res);
  } catch (e) {
    console.error('Request error:', e);
    if (!res.headersSent) send(res, 500, 'Internal Server Error');
    else res.destroy();
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(PORT, '127.0.0.1', () => {
  // Playwright watches stdout for this exact string to know the server is ready
  console.log(`Server listening on http://127.0.0.1:${PORT}`);
});
