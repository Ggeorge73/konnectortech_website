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
    // Capability statement is switched off for launch; "Book a 30-minute call" opens the form (owner decisions, 14 Nov 2026)
    await expect(sent.getByRole('link', { name: /capability statement/ })).toHaveCount(0);
    await expect(sent.getByRole('link', { name: 'Book a 30-minute call' })).toHaveAttribute('href', '/contact/?ask=call');
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

  test('scene 2: choosing a gap card points to its gap, by mouse and by keyboard, in brief mode', async ({ page }) => {
    await page.goto('/?mode=brief');
    const scene = page.locator('[data-scene="2"]');
    const cards = scene.locator('.gap-list button');
    await expect(scene.locator('.gap-pin')).toHaveCount(3); // all three gaps are marked before anything is chosen
    await expect(cards.nth(1)).toContainText('Gap 02');
    await cards.nth(1).click();
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(scene).toHaveAttribute('data-gap-active', '1');
    await cards.nth(2).click(); // another card switches it
    await expect(scene).toHaveAttribute('data-gap-active', '2');
    await expect(cards.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await cards.nth(2).click(); // the same card again turns it off
    await page.mouse.move(2, 2);
    await expect(scene).not.toHaveAttribute('data-gap-active', /./);
    await cards.nth(0).focus();
    await page.keyboard.press('Enter');
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Space');
    await expect(cards.nth(0)).toHaveAttribute('aria-pressed', 'false');
    expect(new URL(page.url()).pathname).toBe('/'); // it never sends the visitor to the form
    expect(await events(page)).not.toContain('form_started');
  });

  test('scene 2 in story mode: the chosen gap label lights up in the 3D scene, on the Light tier too', async ({ page }) => {
    await page.goto('/?mode=story&tier=light');
    await page.waitForFunction(() => (window as unknown as { __ktStory?: { ready(): boolean } }).__ktStory?.ready(), null, { timeout: 30000 });
    await page.evaluate(() => { const r = document.querySelector('[data-scene="2"]')!.getBoundingClientRect(); window.scrollTo(0, r.top + scrollY + (r.height - innerHeight) * 0.7); });
    const tag = page.locator('[data-hud="gap-1"]');
    await expect(tag).toHaveCSS('opacity', '1', { timeout: 20000 }); // marked with nothing chosen, while the scene rests
    await page.locator('[data-scene="2"] .gap-list button').nth(1).click();
    await expect(tag).toHaveClass(/is-hot/);
    await expect(page.locator('[data-hud="gap-0"]')).not.toHaveClass(/is-hot/);
    await expect(page.locator('[data-hud="gap-0"]')).toHaveCSS('opacity', '0.45');
  });

  test('frontier technology: three cards after the sectors, standing in as scene 6, as text only, with Konnector as the integrator', async ({ page }) => {
    await page.goto('/?mode=brief');
    const section = page.locator('#frontier');
    await expect(section.getByRole('heading', { level: 2 })).toHaveText('Frontier technology, landed.');
    const cards = section.locator('.frontier-card');
    await expect(cards).toHaveCount(3);
    // Every technology serves both sides, and its card says so
    for (const [name, pub, pri] of [['Koniku', 'border screening', 'Industrial sites'], ['QVITI', 'public health systems', 'rehabilitation clinics'], ['RSQ HOLO', 'teaching hospitals', 'surgical centres']]) {
      const card = cards.filter({ has: page.getByRole('heading', { name: new RegExp(`^${name}`) }) });
      await expect(card).toHaveCount(1);
      await expect(card.locator('.stamp').first()).toHaveText('Public and private sector');
      for (const label of ['What it is', 'Where it fits', 'What Konnector does to land it']) await expect(card.getByText(label, { exact: true })).toBeVisible();
      await expect(card.locator('.frontier-fit li').nth(0)).toContainText('Public:');
      await expect(card.locator('.frontier-fit li').nth(0)).toContainText(pub);
      await expect(card.locator('.frontier-fit li').nth(1)).toContainText('Private:');
      await expect(card.locator('.frontier-fit li').nth(1)).toContainText(pri);
      await expect(card.locator('.frontier-steps li')).toHaveCount(5);
    }
    // Cleared for publication: no draft stamps left, and the identification-only line stays
    await expect(section.locator('.stamp.draft, .draft-note')).toHaveCount(0);
    await expect(section).toContainText('Company names are used for identification only.');
    // Text names only: no logos, and never called partners
    await expect(section.locator('img, svg')).toHaveCount(0);
    expect((await section.innerText()).toLowerCase()).not.toContain('partner');
    await expect(section).toContainText('We do not invent these devices');
    // It sits after the sectors scene and before the finale. With delivery records and credentials switched off,
    // it is scene 6 itself, and the proof section is not on the page.
    const order = await page.evaluate(() => ['sectors', 'frontier', 'about'].map((id) => document.getElementById(id)!.getBoundingClientRect().top));
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    await expect(section).toHaveAttribute('data-scene', '6');
    await expect(page.locator('#proof')).toHaveCount(0);
    // Both sector pages show all three, each with that side's fit and a link back to its card on the home page
    for (const [path, fits] of [['/public-sector/', ['border screening', 'public health systems', 'teaching hospitals']], ['/private-sector/', ['Industrial sites', 'rehabilitation clinics', 'surgical centres']]] as const) {
      await page.goto(path);
      const sectorCards = page.locator('.frontier-card');
      await expect(sectorCards).toHaveCount(3);
      for (const [i, key] of ['koniku', 'qviti', 'rsq-holo'].entries()) {
        await expect(sectorCards.nth(i)).toContainText(fits[i]);
        await expect(sectorCards.nth(i).getByRole('link', { name: 'How we land it' })).toHaveAttribute('href', `/#frontier-${key}`);
      }
      await expect(page.locator('.frontier-card img, .frontier-card svg')).toHaveCount(0);
    }
  });

  test('choosing a door sets the secondary button and the form sector, and is recorded', async ({ page }) => {
    await page.goto('/?mode=brief');
    const scene5 = page.locator('[data-scene="5"]');
    // Capability statement switched off for launch: the call button serves both doors
    await expect(scene5.getByRole('link', { name: /capability statement/ })).toHaveCount(0);
    await expect(scene5.getByRole('link', { name: 'Book a 30-minute call' })).toBeVisible();
    await page.getByRole('button', { name: /^Public sector/ }).click();
    await expect(scene5.getByRole('link', { name: 'Book a 30-minute call' })).toBeVisible();
    await page.getByRole('button', { name: /^Private sector/ }).click();
    await expect(scene5.getByRole('link', { name: 'Book a 30-minute call' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Private sector' })).toBeChecked();
    await page.getByRole('link', { name: 'Get a delivery plan' }).first().click();
    expect(await events(page)).toEqual(expect.arrayContaining(['brief_mode_opened', 'scene_reached', 'sector_chosen', 'cta_click']));
  });

  test('story mode starts the 3D scene, and offers no "Skip the story"', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?mode=story');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); // the headline never waits for the 3D
    await expect(page.locator('html')).toHaveAttribute('data-story-ready', '1', { timeout: 30_000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole('button', { name: 'Skip the story' })).toHaveCount(0);
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'story');
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
  for (const path of ['/?mode=brief', '/contact/', '/public-sector/', '/services/project-and-program-delivery/', '/how-we-deliver/', '/about/']) {
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

// Launch decisions (owner, 14 Nov 2026): delivery records, credentials and the capability statement are switched off
// until the content exists, and the privacy notice names the bot check and links Cloudflare's addendum.
test('launch: switched-off sections leave no section, link or button behind', async ({ page, request }) => {
  expect((await request.get('/proof/')).status()).toBe(404);
  for (const path of ['/', '/?mode=brief', '/about/', '/contact/', '/public-sector/', '/private-sector/', '/services/', '/how-we-deliver/']) {
    await page.goto(path);
    await expect(page.locator('a[href^="/proof"], a[href="#proof"], a[href*="ask=statement"]')).toHaveCount(0);
    await expect(page.locator('.cred-strip, .record, table.facts, .stamp.draft, .draft-note')).toHaveCount(0);
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('capability statement');
  }
  await page.goto('/privacy/');
  await expect(page.getByRole('link', { name: 'Cloudflare Turnstile Privacy Addendum' })).toHaveAttribute('href', 'https://www.cloudflare.com/turnstile-privacy-policy/');
});
