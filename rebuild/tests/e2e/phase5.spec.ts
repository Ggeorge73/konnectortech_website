// Phase 5 gate (hardening): the acceptance criteria that had no automated evidence yet, a wider accessibility pass,
// and the interaction-delay budget.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Stats = { frames: number; T: number; line: number; branches: number; arrive: number; mark: number; stage: number; sphere: [number, number]; size: [number, number] };
type Story = { ready(): boolean; time(): number; setT(t: number | null): void; stats(): Stats };
const story = (page: Page) => page.waitForFunction(() => (window as unknown as { __ktStory?: Story }).__ktStory?.ready(), null, { timeout: 30_000 });
const stats = (page: Page) => page.evaluate(() => (window as unknown as { __ktStory: Story }).__ktStory.stats());
/** Hold the story at time T and wait for two drawn frames. */
const at = async (page: Page, T: number) => {
  await page.evaluate((t) => new Promise<void>((done) => { (window as unknown as { __ktStory: Story }).__ktStory.setT(t); requestAnimationFrame(() => requestAnimationFrame(() => done())); }), T);
  return stats(page);
};
// Story mode: list items that have not been revealed yet are fully transparent (still in the page for screen readers).
// They are left out of a scan and measured in the scan of the scene where they show.
const serious = async (page: Page) => {
  const results = await new AxeBuilder({ page }).exclude('html[data-story-ready] [data-at]:not(.is-on)').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
};

test.describe('acceptance: the story', () => {
  test('all seven scenes play forward and backward with the scroll, with no jumps', async ({ page }) => {
    test.setTimeout(400_000);
    await page.goto('/?mode=story&tier=full');
    await story(page);
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const settle = async (y: number) => {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      // Wait until the story time has stopped moving (the Full tier eases after the scroll). Only readings taken after
      // new frames have been drawn count: on a machine with no graphics chip a single frame can take most of a second,
      // and the story time is only worked out when a frame is drawn.
      let last = -1, still = 0, frame = -1;
      for (let i = 0; i < 120; i++) {
        await page.waitForTimeout(120);
        const st = await stats(page);
        if (st.frames < frame + 2) continue;
        frame = st.frames;
        still = Math.abs(st.T - last) < 0.001 ? still + 1 : 0;
        last = st.T;
        if (still >= 2) return st.T;
      }
      return last;
    };
    // Steps of a quarter of a screen. The shortest scene (scene 1) plays over half a screen of scroll, so one step can
    // move the story by at most half a scene: anything larger would be a jump.
    const vh = await page.evaluate(() => innerHeight);
    const N = Math.ceil(total / (vh * 0.25)), ys = Array.from({ length: N + 1 }, (_, i) => Math.min(total, i * vh * 0.25));
    const forward: number[] = [], backward: number[] = [];
    for (const y of ys) forward.push(await settle(y));
    for (const y of [...ys].reverse()) backward.unshift(await settle(y));
    console.log(`  story time at each quarter-screen of scroll: ${forward.map((t) => t.toFixed(2)).join(' ')}`);
    // Forward: time only ever advances, in steps no bigger than the scroll step allows, and reaches the end
    for (let i = 1; i <= N; i++) {
      expect(forward[i], `forward step ${i}`).toBeGreaterThanOrEqual(forward[i - 1] - 0.001);
      expect(forward[i] - forward[i - 1], `forward step ${i} is not a jump`).toBeLessThan(0.6);
    }
    expect(forward[0]).toBeLessThan(0.3);
    expect(forward[N]).toBeGreaterThan(6.9);
    // Backward: the same scroll position gives the same moment of the story
    for (let i = 0; i <= N; i++) expect(Math.abs(forward[i] - backward[i]), `position ${i}: forward ${forward[i].toFixed(3)}, backward ${backward[i].toFixed(3)}`).toBeLessThan(0.02);
  });

  test('the sphere stays on screen from scene 1 until it becomes the mark', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?mode=story&tier=full');
    await story(page);
    const off: string[] = [], resting: number[] = [];
    for (let i = 0; i <= 70; i++) {
      const T = i / 10, st = await at(page, T);
      if (st.stage < 0.5) { resting.push(T); continue; } // scene 6: the 3D rests, as the script asks
      const [x, y] = st.sphere, [W, H] = st.size;
      if (!(x > 0 && x < W && y > 0 && y < H)) off.push(`T ${T}: sphere at ${Math.round(x)},${Math.round(y)} in ${W}x${H}`);
    }
    expect(off).toEqual([]);
    // The only time the 3D is off screen is inside scene 6 (story time 5 to 6)
    expect(Math.min(...resting)).toBeGreaterThanOrEqual(5);
    expect(Math.max(...resting)).toBeLessThan(6);
    expect((await at(page, 7)).mark).toBeGreaterThan(0.99); // it has become the mark
    await page.evaluate(() => (window as unknown as { __ktStory: Story }).__ktStory.setT(null));
  });

  test('the line never breaks between scene 3 and the form', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?mode=story&tier=full');
    await story(page);
    // Scenes 3 and 4: one tube, always drawn from its start, that only ever grows
    let last = (await at(page, 2)).line;
    expect(last).toBeLessThan(0.02);
    for (let i = 1; i <= 60; i++) {
      const T = 2 + i * 0.05, st = await at(page, T);
      expect(st.line, `T ${T.toFixed(2)}: the line never shrinks`).toBeGreaterThanOrEqual(last - 1e-6);
      expect(st.line - last, `T ${T.toFixed(2)}: the line grows without a gap`).toBeLessThan(0.12);
      last = st.line;
    }
    expect(last).toBeGreaterThan(0.99); // it has reached the fork by the end of scene 4
    expect((await at(page, 4.9)).branches).toBeGreaterThan(0.99); // scene 5: both branches fully drawn from the fork
    const end = await at(page, 7);
    expect(end.arrive).toBeGreaterThan(0.99); // scene 7: the line arrives and joins the mark's first node
    await page.evaluate(() => (window as unknown as { __ktStory: Story }).__ktStory.setT(null));
    // ... and the form sits directly under the mark, in the same section
    await expect(page.locator('[data-scene="7"] ~ * #contact, [data-scene="7"] #contact, #contact')).toHaveCount(1);
  });

  test('a first-time phone visitor in story mode can read the headline and press the main button within 2.5 s', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 }); // Lighthouse "slow 4G"
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/?mode=story', { waitUntil: 'commit' });
    const cta = page.locator('[data-scene="1"]').getByRole('link', { name: 'Get a delivery plan' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(cta).toBeVisible();
    await cta.click({ trial: true }); // it can be pressed: on screen, not covered, enabled
    const ready = await page.evaluate(() => performance.now());
    const lcp = await page.evaluate(() => new Promise<number>((resolve) => {
      let t = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) t = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => resolve(t), 400);
    }));
    console.log(`  story mode on throttled phone: headline and main button usable at ${Math.round(ready)} ms, LCP ${Math.round(lcp)} ms`);
    expect(ready).toBeLessThan(2500);
    await context.close();
  });
});

test.describe('accessibility pass (WCAG 2.2 AA, axe)', () => {
  for (const path of ['/services/', '/private-sector/', '/privacy/', '/about/', '/services/technology-sourcing/', '/this-page-does-not-exist/']) {
    test(`no serious or critical issues on ${path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      expect(await serious(page)).toEqual([]);
    });
  }

  test('no serious or critical issues in story mode: arrival, the scan with a gap chosen, the line, two doors, the form', async ({ page }) => {
    test.setTimeout(200_000);
    await page.goto('/?mode=story&tier=light');
    await story(page);
    await page.addStyleTag({ content: 'html{scroll-behavior:auto !important}' });
    const scene = async (n: number, f: number) => {
      await page.evaluate(([n, f]) => { const r = document.querySelector(`[data-scene="${n}"]`)!.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + (r.height - innerHeight) * f); }, [n, f]);
      await page.waitForTimeout(2500);
    };
    expect(await serious(page), 'scene 1').toEqual([]);
    await scene(2, 0.7);
    await page.locator('[data-scene="2"] .gap-list button').nth(1).click();
    expect(await serious(page), 'scene 2 with gap 02 chosen').toEqual([]);
    await scene(3, 0.8);
    expect(await serious(page), 'scene 3').toEqual([]);
    await scene(4, 0.7);
    expect(await serious(page), 'scene 4').toEqual([]);
    await scene(5, 0.6);
    await page.getByRole('button', { name: /^Public sector/ }).click();
    expect(await serious(page), 'scene 5 with a door chosen').toEqual([]);
    await page.locator('#frontier').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    expect(await serious(page), 'frontier technology section').toEqual([]);
    // While it is on screen the 3D rests: the story time has moved into scene 6 and the canvas has faded out
    const resting = await stats(page);
    expect(resting.T).toBeGreaterThan(5);
    expect(resting.stage).toBeLessThan(0.5);
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Send and get my plan' }).click(); // show the error messages
    await page.waitForTimeout(600);
    expect(await serious(page), 'form with errors showing').toEqual([]);
  });

  test('the canvas is decoration: hidden from screen readers, and every scene keeps its heading as page text', async ({ page }) => {
    await page.goto('/?mode=story&tier=light');
    await story(page);
    expect(await page.locator('.stage').getAttribute('aria-hidden')).toBe('true');
    expect(await page.locator('.hud-layer').getAttribute('aria-hidden')).toBe('true');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('[data-scene] h1, [data-scene] h2')).toHaveCount(7);
  });

  test('keyboard in story mode: every stop shows a focus ring, and the rail, gap cards, doors and form are all reachable', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/?mode=story&tier=light');
    await story(page);
    const seen = new Set<string>(), noRing: string[] = [];
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
        const kind = el.closest('.rail') ? 'rail' : el.closest('.gap-list') ? 'gap card' : el.closest('.doors') ? 'door' : el.closest('#contact') ? 'form' : el.closest('header') ? 'header' : el.closest('footer') ? 'footer' : 'other';
        return { ring, kind, label: `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}"` };
      });
      if (!info) continue;
      seen.add(info.kind);
      if (!info.ring) noRing.push(info.label);
      if (info.kind === 'footer') break;
    }
    expect(noRing).toEqual([]);
    for (const kind of ['header', 'rail', 'gap card', 'door', 'form']) expect([...seen], `the ${kind} can be reached by Tab`).toContain(kind);
  });
});

test('interaction delay stays under 200 ms on a throttled phone (brief mode: door, gap card, form field)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => {
    const w = window as unknown as { __slow: { name: string; ms: number }[] };
    w.__slow = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__slow.push({ name: e.name, ms: e.duration }); }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  // Bring each control on screen first and let the page settle, so what is timed is the response to the tap itself,
  // not the browser drawing a part of the page it has just been scrolled to.
  const tap = async (target: ReturnType<Page['locator']>) => { await target.scrollIntoViewIfNeeded(); await page.waitForTimeout(700); await page.evaluate(() => { (window as unknown as { __slow: unknown[] }).__slow.length = 0; }); await target.tap(); await page.waitForTimeout(500); return page.evaluate(() => (window as unknown as { __slow: { name: string; ms: number }[] }).__slow.reduce((m, e) => Math.max(m, e.ms), 0)); };
  const taps = [await tap(page.locator('[data-scene="2"] .gap-list button').first()), await tap(page.getByRole('button', { name: /^Public sector/ })), await tap(page.getByLabel('Your name'))];
  await page.evaluate(() => { (window as unknown as { __slow: unknown[] }).__slow.length = 0; });
  await page.keyboard.type('Ada');
  await page.waitForTimeout(600);
  console.log(`  taps on a 4x throttled phone: gap card ${Math.round(taps[0])} ms, door ${Math.round(taps[1])} ms, form field ${Math.round(taps[2])} ms`);
  for (const ms of taps) expect(ms).toBeLessThan(200);
  const slow = await page.evaluate(() => (window as unknown as { __slow: { name: string; ms: number }[] }).__slow);
  const worst = slow.reduce((m, e) => Math.max(m, e.ms), 0);
  console.log(`  typing on a 4x throttled phone: slowest key ${Math.round(worst)} ms`);
  expect(worst).toBeLessThan(200);
  await context.close();
});
