// Performance budgets from the rebuild script, checked against the build output.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const out = path.join(process.cwd(), 'out');
const gz = (f) => zlib.gzipSync(fs.readFileSync(f)).length;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const scripts = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]))];
const firstLoad = scripts.reduce((n, s) => n + gz(path.join(out, s)), 0) + gz(path.join(out, 'index.html'));
const allChunks = fs.readdirSync(path.join(out, '_next/static/chunks'), { recursive: true }).filter((f) => String(f).endsWith('.js')).map((f) => path.join(out, '_next/static/chunks', String(f)));
const lazy = allChunks.filter((f) => !scripts.some((s) => f.endsWith(path.basename(s)))).filter((f) => fs.readFileSync(f, 'utf8').includes('WebGLRenderer'));
const threeD = lazy.reduce((n, f) => n + gz(f), 0);
const poster = fs.statSync(path.join(out, 'stills/poster.jpg')).size + fs.statSync(path.join(out, 'stills/scene-1.jpg')).size;

const checks = [
  ['First-load script + HTML on the home page (compressed) under 200 KB', firstLoad, 200 * 1024],
  ['3D code is not in the first load (loaded after first paint)', scripts.some((s) => fs.readFileSync(path.join(out, s), 'utf8').includes('WebGLRenderer')) ? 1 : 0, 0.5],
  ['3D code + assets under 1.5 MB (Light tier budget; there are no model or texture downloads)', threeD, 1.5 * 1024 * 1024],
  ['Hero still images under 200 KB', poster, 200 * 1024],
];
let failed = false;
for (const [name, value, limit] of checks) {
  const ok = value < limit;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${value > 1024 ? kb(value) : value}`);
}
process.exit(failed ? 1 : 0);
