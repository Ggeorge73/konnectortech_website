// Tiny static server for the export folder, with the form endpoint wired to the real Pages Function.
// Used for local preview and by the end-to-end tests. Usage: node scripts/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { onRequestPost } from '../functions/api/contact.js';

const port = Number(process.argv[2] || process.env.PORT || 4173);
const root = path.join(process.cwd(), 'out');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };
const store = new Map(); // stands in for the ENQUIRIES KV namespace
const kv = { get: async (k) => store.get(k) ?? null, put: async (k, v) => void store.set(k, v) };
export const sent = [];

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (url.pathname === '/api/contact' && req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'CF-Connecting-IP': req.socket.remoteAddress || '' }, body: Buffer.concat(chunks) });
      const r = await onRequestPost({ request, env: { ENQUIRIES: kv }, waitUntil: () => {} });
      res.writeHead(r.status, { 'content-type': 'application/json' });
      return res.end(await r.text());
    }
    if (url.pathname === '/__enquiries') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify([...store.entries()].filter(([k]) => !k.startsWith('rl:')))); }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); return res.end(fs.existsSync(path.join(root, '404.html')) ? fs.readFileSync(path.join(root, '404.html')) : 'Not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
