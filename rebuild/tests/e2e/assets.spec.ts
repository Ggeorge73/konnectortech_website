// The Higgsfield assets: the far backdrop of scenes 4 and 5 (story mode only, each tier its own size, harmless if it
// fails) and the recorded sound (fetched only once a visitor turns sound on, synthesised sound if a file is missing).
// Brief mode loading none of it is covered by "brief mode loads no 3D code or models" in phase2.spec.ts.
import { expect, test, type Page } from '@playwright/test';

type Story = { ready(): boolean; setT(t: number | null): void; stats(): { frames: number } };
const story = (page: Page) => page.waitForFunction(() => (window as unknown as { __ktStory?: Story }).__ktStory?.ready(), null, { timeout: 30_000 });
/** Hold the story at time T until a few frames have been drawn there. */
const at = async (page: Page, T: number) => {
  await page.evaluate((t) => (window as unknown as { __ktStory: Story }).__ktStory.setT(t), T);
  const start = await page.evaluate(() => (window as unknown as { __ktStory: Story }).__ktStory.stats().frames);
  await page.waitForFunction((f) => (window as unknown as { __ktStory: Story }).__ktStory.stats().frames > f + 3, start, { timeout: 20_000 });
};
/** Average brightness of the sky and the horizon (below the header, above the lower third), 0 to 255. */
const skyBrightness = async (page: Page) => {
  const png = await page.screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const top = Math.floor(img.height * 0.1);
    const d = g.getImageData(0, top, img.width, Math.floor(img.height * 0.66) - top).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    return sum / (d.length / 4);
  }, png.toString('base64'));
};

test.describe('scenes 4 and 5 backdrop', () => {
  for (const tier of ['light', 'full'] as const) {
    test(`story mode on ${tier} loads only the ${tier} pictures`, async ({ page }) => {
      const requested: string[] = [];
      page.on('request', (r) => requested.push(new URL(r.url()).pathname));
      await page.goto(`/?mode=story&tier=${tier}`);
      await story(page);
      await expect.poll(() => requested.filter((p) => p.includes('/models/backdrop_')).sort()).toEqual([`/models/backdrop_4.${tier}.jpg`, `/models/backdrop_5.${tier}.jpg`]);
    });
  }

  test('it shows in scene 5, and the story carries on without it if it cannot load', async ({ browser }) => {
    test.setTimeout(120_000);
    const run = async (block: boolean) => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (block) await page.route('**/models/backdrop_*', (r) => r.abort());
      await page.goto('/?mode=story&tier=light');
      await story(page);
      await page.waitForLoadState('networkidle'); // the pictures have arrived (or failed)
      await at(page, 4.5);
      const sky = await skyBrightness(page);
      const mode = await page.locator('html').getAttribute('data-mode');
      await context.close();
      return { sky, mode, errors };
    };
    const shown = await run(false), missing = await run(true);
    expect(missing.mode).toBe('story'); // a missing backdrop never sends the visitor to brief mode
    expect(missing.errors).toEqual([]);
    expect(shown.errors).toEqual([]);
    expect(shown.sky).toBeGreaterThan(missing.sky + 10); // the glow of the city's horizon, over the plain night
  });
});

test.describe('recorded sound', () => {
  test('nothing is fetched until sound is turned on, then the hum and the tick', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(new URL(r.url()).pathname));
    await page.goto('/?mode=story&tier=light');
    await story(page);
    expect(requested.filter((p) => p.startsWith('/audio/'))).toEqual([]);
    await page.getByRole('button', { name: 'Turn sound on' }).click();
    await expect.poll(() => requested.filter((p) => p.startsWith('/audio/')).sort()).toEqual(['/audio/hum.mp3', '/audio/tick.mp3']);
  });

  test('if the recordings cannot load, the synthesised sound plays and nothing breaks', async ({ page }) => {
    const errors: string[] = [], warnings: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'warning') warnings.push(m.text()); });
    await page.route('**/audio/*', (r) => r.fulfill({ status: 404, body: '' }));
    await page.goto('/?mode=story&tier=light');
    await story(page);
    await page.getByRole('button', { name: 'Turn sound on' }).click();
    await expect.poll(() => warnings.filter((w) => /synthesised/.test(w)).length).toBe(2);
    await at(page, 3.5); // rings lock in scene 4: the click stands in for the tick
    expect(errors).toEqual([]);
  });
});
