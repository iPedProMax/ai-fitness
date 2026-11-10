import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Khalories Q4.16C: safe release-gate browser checks.
 * READ-ONLY: never submits credentials, food, photos, barcodes, or AI requests.
 * Dedicated staging session is optional; do not commit playwright/.auth files.
 */
const stagingState = path.join(process.cwd(), 'playwright', '.auth', 'staging-user.json');

function noHorizontalClipping(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
}

test.describe('Q4.16C public and guest release gates (read-only)', () => {
  test('login page displays sign-in inputs but does not submit credentials', async ({ page }) => {
    const response = await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  });

  test('guest cannot view private Meal History', async ({ page }) => {
    const response = await page.goto('/meals', { waitUntil: 'domcontentloaded' });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/auth\/login(?:\?|$)/);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('guest cannot read private AI-usage balance', async ({ request }) => {
    const response = await request.get('/api/ai/usage', { maxRedirects: 0 });
    expect([401, 403], 'Anonymous AI-usage requests must be rejected').toContain(response.status());
  });

  test('mobile sign-in fits a 390px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    const dimensions = await noHorizontalClipping(page);
    expect(dimensions.documentWidth, 'Login page must not overflow horizontally').toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  });
});

test.describe('Q4.16C signed-in staging UI (read-only, optional)', () => {
  test.skip(!existsSync(stagingState),
    'No Playwright staging test session yet. Guest tests still run; authenticated release checks remain unverified.');
  test.use({ storageState: stagingState });

  const signInHelp =
    'Playwright staging session is missing/expired or was saved for localhost instead of 127.0.0.1. ' +
    'Use a dedicated staging test account: npx.cmd playwright codegen --save-storage=playwright/.auth/staging-user.json ' +
    'http://127.0.0.1:3000/auth/login ; sign in, then close the codegen browser. ' +
    'Never commit or share staging-user.json.';

  test('staging session can open private Meal History (authentication gate)', async ({ page }) => {
    const response = await page.goto('/meals', { waitUntil: 'domcontentloaded' });
    expect(response, 'Protected Meal History must respond').not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    expect(new URL(page.url()).pathname, signInHelp).not.toMatch(/^\/auth\/login\/?$/);
    await expect(page.getByRole('heading', { name: 'Meal History' }), signInHelp).toBeVisible({ timeout: 15_000 });
  });

  test.describe('UI after the staging authentication check', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      // One invalid staging login should not produce three misleading UI failures.
      test.skip(/^\/auth\/login\/?$/.test(new URL(page.url()).pathname), signInHelp);
      await expect(page.getByRole('heading', { name: 'Meal History' }),
        'Signed-in Meal History failed to render after navigating past authentication.').toBeVisible({ timeout: 15_000 });
    });

    test('Log Food switches Manual, Barcode and Photo modes without a request', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      const modes = page.getByRole('group', { name: 'How to log food' });
      await expect(modes).toBeVisible({ timeout: 15_000 });
      await modes.getByRole('button', { name: /manual/i }).click();
      await expect(page.getByText('Manual food entry')).toBeVisible({ timeout: 15_000 });
      await modes.getByRole('button', { name: /barcode/i }).click();
      await expect(page.getByText('Scan a food barcode')).toBeVisible({ timeout: 15_000 });
      await modes.getByRole('button', { name: /photo scanner/i }).click();
      await expect(modes.getByRole('button', { name: /photo scanner/i })).toHaveAttribute('aria-pressed', 'true');
    });

    test('Manual and Barcode modes have room on a narrow mobile screen', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/?mode=manual', { waitUntil: 'domcontentloaded' });
      const modes = page.getByRole('group', { name: 'How to log food' });
      await expect(modes).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Manual food entry')).toBeVisible({ timeout: 15_000 });
      let size = await noHorizontalClipping(page);
      expect(size.documentWidth, 'Manual must not force horizontal page scrolling').toBeLessThanOrEqual(size.viewportWidth + 2);
      await modes.getByRole('button', { name: /barcode/i }).click();
      await expect(page.getByText('Scan a food barcode')).toBeVisible({ timeout: 15_000 });
      size = await noHorizontalClipping(page);
      expect(size.documentWidth, 'Barcode must not force horizontal page scrolling').toBeLessThanOrEqual(size.viewportWidth + 2);
    });

    test('Meal History shows records without performing any write', async ({ page }) => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Meal History' })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('navigation', { name: 'Meal History navigation' })).toBeVisible();
    });

    test('existing meal thumbnail opens and closes without changing the meal', async ({ page }) => {
      await page.goto('/meals', { waitUntil: 'domcontentloaded' });
      const thumbnail = page.getByRole('button', { name: /^Enlarge saved photo:/ }).first();
      test.skip((await thumbnail.count()) === 0, 'No stored meal thumbnail in this staging account.');
      const summary = thumbnail.locator('xpath=ancestor::summary');
      const wasExpanded = await summary.locator('xpath=parent::details').evaluate(el => (el as HTMLDetailsElement).open);
      await thumbnail.click();
      await expect(page.getByRole('dialog', { name: /^Saved meal photo:/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /^Saved meal photo:/ })).toHaveCount(0);
      const remainsExpanded = await summary.locator('xpath=parent::details').evaluate(el => (el as HTMLDetailsElement).open);
      expect(remainsExpanded, 'Previewing a photo must not expand or collapse the meal').toBe(wasExpanded);
    });
  });
});
