#!/usr/bin/env node
// Tiny zero-dependency static file server for local dev.
// Usage: node scripts/serve.mjs [dir] [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] || 'dist';
const port = Number(process.argv[3] || 4321);
const serveRoot = join(root, dir);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname);
    if (urlPath === '/') urlPath = '/index.html';
    let filePath = normalize(join(serveRoot, urlPath));
    if (!filePath.startsWith(serveRoot)) { res.writeHead(403); return res.end('Forbidden'); }
    if (!existsSync(filePath) && !urlPath.endsWith('.html')) {
      // SPA-ish fallback: /cloud-hosting -> /cloud-hosting.html
      filePath = join(serveRoot, urlPath + '.html');
    }
    if (!existsSync(filePath)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404 not found'); }
    const s = await stat(filePath);
    if (s.isDirectory()) { filePath = join(filePath, 'index.html'); }
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('500 ' + e.message);
  }
});

server.listen(port, () => {
  console.log(`madeineurope.dev dev server → http://localhost:${port}  (serving ${dir}/)`);
});