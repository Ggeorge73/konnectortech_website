// Phase 2 gate: device tiers, brief mode standing on its own, budgets, and the analytics event list.
import { expect, test, type Browser, type BrowserContextOptions } from '@playwright/test';

// Pretend to be a given graphics chip / device, so the tier choice can be tested on one machine.
type Device = { renderer?: string; cores?: number; memory?: number; saveData?: boolean; effectiveType?: string; noWebgl?: boolean; context?: BrowserContextOptions };
async function open(browser: Browser, device: Device, url = '/') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...device.context });
  await context.addInitScript((d: Device) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => d.cores ?? 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => d.memory ?? 8 });
    Object.defineProperty(navigator, 'connection', { get: () => ({ saveData: !!d.saveData, effectiveType: d.effectiveType ?? '4g', downlink: 10 }) });
    if (d.noWebgl) {
      const orig = HTMLCanvasElement.prototype.getContext;
      // @ts-expect-error test stub
      HTMLCanvasElement.prototype.getContext = function (type: string, ...rest: unknown[]) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); };
    } else if (d.renderer) {
      const gp = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (p: number) { return p === 0x9246 ? d.renderer : gp.call(this, p); };
    }
  }, device);
  const page = await context.newPage();
  await page.goto(url);
  const html = page.locator('html');
  return { page, context, mode: await html.getAttribute('data-mode'), tier: await html.getAttribute('data-tier'), why: await html.getAttribute('data-brief-why') };
}
const NVIDIA = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)';
const APPLE = 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)';
const INTEL = 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)';
const SOFTWARE = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';

test.describe('tier matrix: the full story is the default', () => {
  const matrix: [string, Device, string, string, string?][] = [
    ['Desktop, capable graphics chip', { renderer: NVIDIA }, 'story', 'full'],
    ['Apple silicon laptop', { renderer: APPLE }, 'story', 'full'],
    ['Laptop with integrated graphics', { renderer: INTEL }, 'story', 'light'],
    ['Office PC with software graphics only', { renderer: SOFTWARE }, 'story', 'light'],
    ['Capable chip but 4 cores', { renderer: NVIDIA, cores: 4 }, 'story', 'light'],
    ['Capable chip but 4 GB memory', { renderer: NVIDIA, memory: 4 }, 'story', 'light'],
    ['Phone (touch, narrow screen)', { renderer: APPLE, context: { viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true } }, 'story', 'light'],
    ['Reduced motion on', { renderer: NVIDIA, context: { reducedMotion: 'reduce' } }, 'brief', 'brief', 'reduced-motion'],
    ['Data saver on', { renderer: NVIDIA, saveData: true }, 'brief', 'brief', 'data-saver'],
    ['Slow connection (2G)', { renderer: NVIDIA, effectiveType: '2g' }, 'brief', 'brief', 'slow-connection'],
    ['3D unavailable (no WebGL)', { noWebgl: true }, 'brief', 'brief', 'no-3d'],
  ];
  for (const [name, device, mode, tier, why] of matrix) {
    test(name, async ({ browser }) => {
      const r = await open(browser, device);
      expect([r.mode, r.tier]).toEqual([mode, tier]);
      if (why) expect(r.why).toBe(why);
      await r.context.close();
    });
  }

  test('visitor choice: "Skip the story" is remembered, and "Play the story" brings it back', async ({ browser }) => {
    const r = await open(browser, { renderer: NVIDIA });
    await r.page.getByRole('button', { name: 'Skip the story' }).first().click();
    await r.page.reload();
    await expect(r.page.locator('html')).toHaveAttribute('data-mode', 'brief');
    await expect(r.page.locator('html')).toHaveAttribute('data-brief-why', 'choice');
    await r.page.getByRole('button', { name: 'Play the story' }).first().click();
    await r.page.reload();
    await expect(r.page.locator('html')).toHaveAttribute('data-mode', 'story');
    await r.context.close();
  });

  test('reduced motion: brief by default, but the visitor can still choose to play the story', async ({ browser }) => {
    const r = await open(browser, { renderer: NVIDIA, context: { reducedMotion: 'reduce' } });
    await r.page.getByRole('button', { name: 'Play the story' }).first().click();
    await expect(r.page.locator('html')).toHaveAttribute('data-mode', 'story');
    await r.context.close();
  });

  test('no 3D: "Play the story" is not offered', async ({ browser }) => {
    const r = await open(browser, { noWebgl: true });
    await expect(r.page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(r.page.getByRole('button', { name: 'Play the story' })).toHaveCount(0);
    await r.context.close();
  });

  test('step-down ladder: slow frames walk Full, Light, Light at lower resolution, then brief mode', async ({ browser }) => {
    // ?simulate-slow=1 (preview builds only) makes the story treat every frame as taking 200 ms
    const r = await open(browser, { renderer: NVIDIA }, '/?simulate-slow=1');
    expect([r.mode, r.tier]).toEqual(['story', 'full']);
    const html = r.page.locator('html');
    await expect(html).toHaveAttribute('data-tier', 'light', { timeout: 40_000 });
    await expect(html).toHaveAttribute('data-low-res', '1', { timeout: 40_000 });
    await expect(html).toHaveAttribute('data-mode', 'brief', { timeout: 40_000 });
    await expect(r.page.getByRole('heading', { level: 1 })).toBeVisible(); // the page carries on in brief mode
    expect(await r.page.evaluate(() => (window.__ktEvents || []).some((e) => e.event === 'brief_mode_opened' && e.props?.reason === 'slow'))).toBe(true);
    await r.context.close();
  });

  test('testers can force a tier from the address', async ({ browser }) => {
    const r = await open(browser, { renderer: NVIDIA }, '/?tier=light');
    expect([r.mode, r.tier]).toEqual(['story', 'light']);
    await r.context.close();
  });
});

test.describe('brief mode could go live by itself', () => {
  test('with scripts turned off, every scene, button and page still reads', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');
    for (const h of ['Every system you own, finally working as one.', 'One accountable partner. One unbroken line.', 'Real projects bend. Ours still arrive.', 'Public mission or private enterprise?', 'Delivered, not promised.', 'Every line reaches its point.']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
    await expect(page.locator('.service-list a')).toHaveCount(4);
    await expect(page.getByRole('link', { name: /Technology sourcing/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send and get my plan' })).toBeVisible();
    await expect(page.locator('.still img').first()).toBeVisible();
    for (const path of ['/services/', '/services/technology-sourcing/', '/how-we-deliver/', '/public-sector/', '/private-sector/', '/about/', '/contact/', '/privacy/']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
    }
    await context.close();
  });

  test('brief mode loads no 3D code or models', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    expect(requested.filter((p) => /\/models\/|\/basis\/|\.glb|\.ktx2/.test(p))).toEqual([]);
    await context.close();
  });

  test('budgets on a mid-range phone on 4G: headline paints within 2.5 s, layout shift under 0.1', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); // Lighthouse "slow 4G"
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => new Promise<{ lcp: number; cls: number; lcpTag: string }>((resolve) => {
      let lcp = 0, cls = 0, lcpTag = '';
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { lcp = e.startTime; lcpTag = ((e as unknown as { element?: Element }).element?.tagName || '').toLowerCase(); } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!(e as unknown as { hadRecentInput: boolean }).hadRecentInput) cls += (e as unknown as { value: number }).value; }).observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => resolve({ lcp, cls, lcpTag }), 500);
    }));
    console.log(`  brief mode on throttled phone: LCP ${Math.round(m.lcp)} ms (${m.lcpTag}), CLS ${m.cls.toFixed(3)}`);
    expect(m.lcp).toBeGreaterThan(0);
    expect(m.lcp).toBeLessThan(2500);
    expect(m.cls).toBeLessThan(0.1);
    await context.close();
  });
});

test('every event in the measurement list is recorded', async ({ page }) => {
  await page.goto('/?mode=brief');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /^Public sector/ }).click();
  await page.getByLabel('Your name').fill('Ada Example');
  await page.getByLabel('Work email').fill('ada@example.org');
  await page.getByLabel('Organization').fill('Example County');
  await page.getByLabel('What do you need delivered?').fill('A records system that has to go live in June.');
  await page.getByRole('button', { name: 'Send and get my plan' }).click();
  await expect(page.getByTestId('form-sent')).toBeVisible();
  const events = await page.evaluate(() => window.__ktEvents || []);
  const names = events.map((e) => e.event);
  expect(events.filter((e) => e.event === 'scene_reached').map((e) => e.props?.scene)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  for (const name of ['brief_mode_opened', 'sector_chosen', 'cta_click', 'form_started', 'form_sent']) expect(names, name).toContain(name);
  expect(events.find((e) => e.event === 'cta_click')?.props).toHaveProperty('position');
  // "story skipped" is covered in site.spec.ts (it needs story mode)
});
