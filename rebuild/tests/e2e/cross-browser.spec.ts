// Runs in Firefox and WebKit (the engine behind Safari) in CI. The full suite runs in Chromium.
// These are the paths a buyer depends on: read the page, choose a sector, send an enquiry, and, where the
// browser has 3D, start the story without errors.
import { expect, test } from '@playwright/test';

test('brief mode: every scene reads and the enquiry is stored and confirmed', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?mode=brief');
  for (const h of ['Every system you own, finally working as one.', 'One accountable partner. One unbroken line.', 'Real projects bend. Ours still arrive.', 'Public mission or private enterprise?', 'Delivered, not promised.', 'Every line reaches its point.']) await expect(page.getByRole('heading', { name: h })).toBeVisible();
  await page.getByRole('button', { name: /^Public sector/ }).click();
  await expect(page.getByRole('radio', { name: 'Public sector' })).toBeChecked();
  const marker = `Cross-browser check ${test.info().project.name}`;
  await page.getByLabel('Your name').fill('Ada Example');
  await page.getByLabel('Work email').fill('ada@example.org');
  await page.getByLabel('Organization').fill(marker);
  await page.getByLabel('What do you need delivered?').fill('A records system that has to go live in June.');
  await page.getByRole('button', { name: 'Send and get my plan' }).click();
  await expect(page.getByTestId('form-sent')).toContainText('Your enquiry is with us');
  const stored = await (await request.get('/__enquiries')).json();
  expect(stored.some(([, v]: [string, string]) => v.includes(marker))).toBe(true);
  expect(errors).toEqual([]);
});

test('a failed send keeps what the visitor typed', async ({ page }) => {
  await page.route('**/api/contact', (r) => r.fulfill({ status: 502, body: '{}' }));
  await page.goto('/contact/');
  await page.getByLabel('Your name').fill('Ada Example');
  await page.getByLabel('Work email').fill('ada@example.org');
  await page.getByLabel('Organization').fill('Example County');
  await page.getByLabel('What do you need delivered?').fill('A records system that has to go live in June.');
  await expect(page.getByTestId('enquiry-form')).toHaveAttribute('data-ready', ''); // the form's script has loaded
  await page.getByRole('button', { name: 'Send and get my plan' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Nothing you typed has been lost' })).toBeVisible();
  await expect(page.getByLabel('What do you need delivered?')).toHaveValue('A records system that has to go live in June.');
});

test('story mode starts where the browser has 3D, and falls back to brief mode where it does not', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?mode=story');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const html = page.locator('html');
  const has3d = (await html.getAttribute('data-can-story')) === '1';
  console.log(`  ${test.info().project.name}: 3D ${has3d ? 'available' : 'not available'}`);
  if (has3d) {
    // Either the story runs, or this machine cannot draw it and the page steps back to brief mode. Both are correct.
    await expect.poll(async () => (await html.getAttribute('data-story-ready')) === '1' || (await html.getAttribute('data-mode')) === 'brief', { timeout: 45_000 }).toBe(true);
    console.log(`  ${test.info().project.name}: ${(await html.getAttribute('data-story-ready')) === '1' ? 'story running' : 'fell back to brief mode'}`);
  } else {
    await expect(html).toHaveAttribute('data-mode', 'brief');
  }
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: 'Send and get my plan' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('supporting pages load with one main heading each', async ({ page }) => {
  for (const path of ['/services/', '/services/systems-implementation-and-integration/', '/how-we-deliver/', '/public-sector/', '/private-sector/', '/about/', '/contact/', '/privacy/']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
  }
});
