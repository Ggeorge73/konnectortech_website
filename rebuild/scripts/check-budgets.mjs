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
// The 3D story (three.js, React Three Fiber, GSAP) is every chunk that no page loads up front.
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const upFront = new Set(walk(out).filter((f) => f.endsWith('.html')).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => path.basename(m[1]))));
const lazy = walk(path.join(out, '_next/static/chunks')).filter((f) => f.endsWith('.js') && !upFront.has(path.basename(f)) && !/\/(app|pages)\/|\/(framework|main|webpack|polyfills)-/.test(f));
// Each tier downloads the shared models plus the textures of its own size (*.full.ktx2 or *.light.ktx2).
const modelFiles = fs.existsSync(path.join(out, 'models')) ? walk(path.join(out, 'models')) : [];
const tierModels = (tier, other) => modelFiles.filter((f) => !f.includes(`.${other}.`)).reduce((n, f) => n + fs.statSync(f).size, 0);
// 3D code = the lazy chunks plus the texture transcoder the KTX2 textures need
const basis = fs.existsSync(path.join(out, 'basis')) ? walk(path.join(out, 'basis')).reduce((n, f) => n + gz(f), 0) : 0;
const code3d = lazy.reduce((n, f) => n + gz(f), 0); // the KTX2 decoder (basis) is downloaded by the Full tier only
console.log(`  3D code ${kb(code3d)} compressed (+ ${kb(basis)} KTX2 decoder on Full); model files: Full ${kb(tierModels('full', 'light'))}, Light ${kb(tierModels('light', 'full'))}`);
const poster = fs.statSync(path.join(out, 'stills/poster.jpg')).size + fs.statSync(path.join(out, 'stills/scene-1.jpg')).size;

const checks = [
  ['First-load script + HTML on the home page (compressed) under 200 KB', firstLoad, 200 * 1024],
  ['3D code is not in the first load (loaded after first paint)', scripts.some((s) => /WebGLRenderer|ScrollTrigger/.test(fs.readFileSync(path.join(out, s), 'utf8'))) ? 1 : 0, 0.5],
  ['Light tier: 3D code + model files under 1.5 MB', code3d + tierModels('light', 'full'), 1.5 * 1024 * 1024],
  ['Full tier: 3D code + KTX2 decoder + model files under 3 MB', code3d + basis + tierModels('full', 'light'), 3 * 1024 * 1024],
  ['Hero still images under 200 KB', poster, 200 * 1024],
];
let failed = false;
for (const [name, value, limit] of checks) {
  const ok = value < limit;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: ${value > 1024 ? kb(value) : value}`);
}
process.exit(failed ? 1 : 0);
