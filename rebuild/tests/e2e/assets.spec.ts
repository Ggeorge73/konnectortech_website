// The recorded sound from Higgsfield: fetched only once a visitor turns sound on, synthesised sound if a file is missing.
import { expect, test, type Page } from '@playwright/test';

type Story = { ready(): boolean; setT(t: number | null): void; stats(): { frames: number } };
const story = (page: Page) => page.waitForFunction(() => (window as unknown as { __ktStory?: Story }).__ktStory?.ready(), null, { timeout: 30_000 });
/** Hold the story at time T until a few frames have been drawn there. */
const at = async (page: Page, T: number) => {
  await page.evaluate((t) => (window as unknown as { __ktStory: Story }).__ktStory.setT(t), T);
  const start = await page.evaluate(() => (window as unknown as { __ktStory: Story }).__ktStory.stats().frames);
  await page.waitForFunction((f) => (window as unknown as { __ktStory: Story }).__ktStory.stats().frames > f + 3, start, { timeout: 20_000 });
};

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
