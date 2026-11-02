import { test, expect } from '@playwright/test';

test('Khalories opens without a browser crash', async ({ page }) => {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response, 'Home must return an HTTP response').not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
});

test('Coach page renders or redirects to sign in', async ({ page }) => {
  const response = await page.goto('/coach', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page.locator('body')).toBeVisible();
});

test('API model status endpoint responds without a server crash', async ({ request }) => {
  const response = await request.get('/api/ai/models');
  expect(response.status()).toBeLessThan(500);
});