import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const events = (page: Page) => page.evaluate(() => (window.__ktEvents || []).map((e) => e.event));
const fill = async (page: Page) => {
  await page.getByLabel('Your name').fill('Ada Example');
  await page.getByLabel('Work email').fill('ada@example.org');
  await page.getByLabel('Organization').fill('Example County');
  await page.getByLabel('What do you need delivered?').fill('A records system that has to go live in June.');
  await page.getByLabel(/When does it need to land/).fill('June');
};

test.describe('enquiry form', () => {
  test('explains problems beside each field in plain words', async ({ page }) => {
    await page.goto('/contact/');
    await page.getByLabel('Work email').fill('not-an-email');
    await page.getByLabel('Organization').focus();
    await expect(page.getByText('Please enter a work email address')).toBeVisible();
    await page.getByRole('button', { name: 'Send and get my plan' }).click();
    await expect(page.getByText('Please add your name.')).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeFocused();
  });

  test('a test enquiry is stored and confirmed in the same frame', async ({ page, request }) => {
    await page.goto('/contact/?sector=public');
    await expect(page.getByRole('radio', { name: 'Public sector' })).toBeChecked(); // sector arrives from the address
    await fill(page);
    await page.getByRole('button', { name: 'Send and get my plan' }).click();
    const sent = page.getByTestId('form-sent');
    await expect(sent).toContainText('Your enquiry is with us');
    await expect(sent).toContainText('ada@example.org');
    await expect(sent).toContainText('one business day');
    await expect(sent.getByRole('link', { name: /capability statement/ })).toBeVisible();
    await expect(sent.getByRole('link', { name: 'Request a call' })).toBeVisible();
    const stored = await (await request.get('/__enquiries')).json();
    expect(stored.some(([k, v]: [string, string]) => k.startsWith('enquiry:') && v.includes('Example County') && v.includes('Public sector'))).toBe(true);
    expect(await events(page)).toEqual(expect.arrayContaining(['form_started', 'form_sent']));
  });

  test('text typed before the page script has loaded is kept and sent', async ({ page }) => {
    // A slow connection: the form is on screen and usable before its script arrives.
    await page.route('**/_next/static/**/*.js', async (r) => { await new Promise((ok) => setTimeout(ok, 1500)); await r.continue(); });
    await page.route('**/api/contact', (r) => r.fulfill({ status: 502, body: '{}' }));
    await page.goto('/contact/', { waitUntil: 'commit' });
    await fill(page);
    await expect(page.getByTestId('enquiry-form')).toHaveAttribute('data-ready', '');
    await page.getByRole('button', { name: 'Send and get my plan' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nothing you typed has been lost' })).toBeVisible();
    await expect(page.getByLabel('Your name')).toHaveValue('Ada Example');
  });

  test('a failed send keeps what the visitor typed', async ({ page }) => {
    await page.route('**/api/contact', (r) => r.fulfill({ status: 502, body: '{}' }));
    await page.goto('/contact/');
    await fill(page);
    await page.getByRole('button', { name: 'Send and get my plan' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Nothing you typed has been lost' })).toBeVisible();
    await expect(page.getByLabel('What do you need delivered?')).toHaveValue('A records system that has to go live in June.');
    await expect(page.getByLabel('Your name')).toHaveValue('Ada Example');
  });
});

test.describe('home page', () => {
  test('brief mode shows every message and every button', async ({ page }) => {
    await page.goto('/?mode=brief');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'brief');
    for (const text of [
      'Every system you own, finally working as one.',
      'Most projects do not fail in the systems. They fail in the gaps between them.',
      'One accountable partner. One unbroken line.',
      'Real projects bend. Ours still arrive.',
      'Public mission or private enterprise?',
      'Delivered, not promised.',
      'Every line reaches its point.',
    ]) await expect(page.getByRole('heading', { name: text })).toBeVisible();
    for (const stage of ['Discover', 'Plan', 'Build and integrate', 'Test and accept', 'Hand over']) await expect(page.locator('.gate-list').getByText(stage, { exact: true })).toBeVisible();
    await expect(page.locator('.service-list a')).toHaveCount(4);
    await expect(page.locator('.gap-list li')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Get a delivery plan' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send and get my plan' })).toBeVisible();
    // The old single-page section links keep working
    for (const id of ['services', 'how', 'sectors', 'about', 'contact']) await expect(page.locator(`#${id}`)).toHaveCount(1);
  });

  test('choosing a door sets the secondary button and the form sector, and is recorded', async ({ page }) => {
    await page.goto('/?mode=brief');
    const scene5 = page.locator('[data-scene="5"]');
    await expect(scene5.getByRole('link', { name: /capability statement/ })).toBeVisible();
    await expect(scene5.getByRole('link', { name: 'Request a call' })).toBeVisible(); // no choice: both
    await page.getByRole('button', { name: /^Private sector/ }).click();
    await expect(scene5.getByRole('link', { name: /capability statement/ })).toBeHidden();
    await expect(scene5.getByRole('link', { name: 'Request a call' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Private sector' })).toBeChecked();
    await page.getByRole('link', { name: 'Get a delivery plan' }).first().click();
    expect(await events(page)).toEqual(expect.arrayContaining(['brief_mode_opened', 'scene_reached', 'sector_chosen', 'cta_click']));
  });

  test('story mode starts the 3D scene, and "Skip the story" opens brief mode', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?mode=story');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the headline never waits for the 3D
    await expect(page.locator('html')).toHaveAttribute('data-story-ready', '1', { timeout: 30_000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole('button', { name: 'Skip the story' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'brief');
    expect(await events(page)).toEqual(expect.arrayContaining(['story_skipped', 'brief_mode_opened']));
    expect(errors).toEqual([]);
  });

  test('reduced motion gets brief mode by itself', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'brief');
    await context.close();
  });

  test('works by keyboard: skip link, rail and doors', async ({ page }) => {
    await page.goto('/?mode=brief');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.getByRole('link', { name: 'Scene 5: Two doors' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#sectors$/);
    await page.getByRole('button', { name: /^Public sector/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('html')).toHaveAttribute('data-sector', 'public');
  });
});

test.describe('accessibility (WCAG 2.2 AA, axe)', () => {
  for (const path of ['/?mode=brief', '/contact/', '/public-sector/', '/services/project-and-program-delivery/', '/how-we-deliver/', '/proof/', '/about/']) {
    test(`no serious or critical issues on ${path}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    });
  }
});

test('search and sharing basics are present', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.jpg/);
  expect(await page.locator('script[type="application/ld+json"]').first().evaluate((el) => el.textContent)).toContain('ProfessionalService');
  expect((await request.get('/sitemap.xml')).ok()).toBe(true);
  expect((await request.get('/og.jpg')).ok()).toBe(true);
});
