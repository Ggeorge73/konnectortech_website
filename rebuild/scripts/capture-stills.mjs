// Renders the stills the site uses from the live 3D scene: one per scene for brief mode, the hero poster,
// the small sphere for page headers, the share image, and (with --video) the 8-second logo reveal.
// Usage: npm run build && npm run stills [-- --video]
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = 4179;
const server = spawn('node', ['scripts/serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const out = path.join(process.cwd(), 'public');
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
fs.mkdirSync(path.join(out, 'media'), { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const HIDE = 'main > section, .site-header, .site-footer, .rail, .action-bar, .preview-banner, .skip { visibility: hidden !important; } .stage-fx { display: none; }';
async function open(w, h, query, hideHud = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${PORT}/?mode=story${query}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE + (hideHud ? '.hud-layer { visibility: hidden !important; }' : '') });
  await page.waitForFunction(() => window.__ktStory?.ready(), null, { timeout: 30000 });
  return page;
}
const shot = async (page, T, file, opts = {}) => {
  await page.evaluate((t) => window.__ktStory.setT(t), T);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 78, ...opts });
  console.log('wrote', file);
};

try {
  let page = await open(1200, 900, '&capture=1');
  for (const [n, T] of [[1, 0.6], [2, 1.78], [3, 2.62], [4, 3.45], [5, 4.75], [7, 6.8]]) await shot(page, T, `stills/scene-${n}.jpg`);
  await page.close();

  page = await open(1600, 900, ''); // the hero poster keeps the live layout, so the 3D fades in over the same frame
  await shot(page, 0.5, 'stills/poster.jpg', { quality: 70 });
  await page.close();

  page = await open(900, 900, '&capture=1', true);
  await page.evaluate(() => window.__ktStory.setT(1.9));
  await page.waitForTimeout(700);
  const box = await page.evaluate(() => { const r = document.querySelector('[data-hud="ring"]').style.transform.match(/translate3d\(([\d.]+)px,\s*([\d.]+)px/); return { x: +r[1], y: +r[2] }; });
  await page.screenshot({ path: path.join(out, 'stills/sphere.jpg'), type: 'jpeg', quality: 80, clip: { x: box.x - 110, y: box.y - 110, width: 220, height: 220 } });
  console.log('wrote stills/sphere.jpg');
  await page.close();

  page = await open(1200, 630, '&capture=1', true);
  await shot(page, 6.82, 'og.jpg', { quality: 82 });
  await page.close();

  if (process.argv.includes('--video')) {
    // The same transformation as an 8-second clip for social media and presentations.
    const tmp = fs.mkdtempSync(path.join(process.cwd(), '.frames-'));
    page = await open(1280, 720, '&capture=1', true);
    const FPS = 24, N = FPS * 8;
    for (let i = 0; i < N; i++) {
      const k = i / (N - 1);
      const T = 6.1 + Math.min(1, k / 0.85) * 0.72; // sweep back, unfold, lock, then hold on the finished mark
      await page.evaluate((t) => window.__ktStory.setT(t), T);
      await page.waitForTimeout(60);
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
    }
    await page.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-movflags', '+faststart', path.join(out, 'media/logo-reveal.mp4')]);
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('wrote media/logo-reveal.mp4');
  }
} finally {
  await browser.close();
  server.kill();
}
