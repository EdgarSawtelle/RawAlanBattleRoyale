// Tiny static file server for local development (no dependencies).
// Usage: node tools/serve.mjs [port] [--prefix=/some/sub/path/]      (default port 8123)
//   --prefix serves the game under a URL sub-path, like GitHub Pages does
//   (https://<user>.github.io/<repo>/): node tools/serve.mjs 8124 --prefix=/RawAlanBattleRoyale/
//   then open http://localhost:8124/RawAlanBattleRoyale/ - anything outside the prefix is a 404.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a))) || 8123;
const prefixArg = (process.argv.find((a) => a.startsWith('--prefix=')) || '').slice(9);
const prefix = prefixArg ? '/' + prefixArg.replace(/^\/+|\/+$/g, '') + '/' : '/';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!rel.startsWith(prefix)) { res.writeHead(404); return res.end('not found (the game is served under ' + prefix + ')'); }
  rel = '/' + rel.slice(prefix.length);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(port, () => console.log('serving ' + root + ' on http://localhost:' + port + prefix));
