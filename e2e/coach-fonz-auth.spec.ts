import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Read-only controls tests. NO clicking Send / Analyze, saving food, or AI inference.
 * Only use a dedicated staging test account. Keep storageState out of Git.
 */
const authFile = path.join(process.cwd(), 'playwright', '.auth', 'staging-user.json');
test.use({ storageState: authFile });

test.beforeAll(() => {
  if (!existsSync(authFile)) throw new Error(
    'Missing staging test login. Run: npx.cmd playwright codegen --save-storage=playwright/.auth/staging-user.json http://127.0.0.1:3000  (sign in and close browser to save)'
  );
});

async function openCoach(page: import('@playwright/test').Page) {
  const response = await page.goto('/coach', { waitUntil: 'domcontentloaded' });
  expect(response, 'Coach page should respond').not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
  await expect(page.locator('#coach-ai-provider'),
    'Signed-in Coach FONZ should show the provider dropdown; check the staging test session').toBeVisible({ timeout: 15_000 });
}

test('authenticated Mistral is listed and enabled on full Coach FONZ', async ({ page }) => {
  await openCoach(page);
  const select = page.locator('#coach-ai-provider');
  const mistral = select.locator('option[value="mistral"]');
  await expect(mistral).toHaveCount(1);
  await expect(mistral, 'Mistral availability check should be enabled by staging policy').toBeEnabled({ timeout: 15_000 });
  await select.selectOption('mistral');
  await page.locator('#coach-message').fill('Suggest a balanced meal after walking.');
  await expect(page.getByRole('button', { name: /ask coach fonz/i })).toBeEnabled();
  // Deliberately do not send: no cloud credits consumed.
});

test('full Coach FONZ keeps local Ollama selection usable during development', async ({ page }) => {
  await openCoach(page);
  const select = page.locator('#coach-ai-provider');
  const local = select.locator('option[value="ollama-local"]');
  await expect(local).toHaveCount(1);
  // If the dropdown already selects Ollama, confirm the dev-only button patch.
  // If a different provider is selected, don't override a disabled local option.
  test.skip((await select.inputValue()) !== 'ollama-local', 'Local Ollama is not the selected default; cannot assess this guard without changing provider selection.');
  await page.locator('#coach-message').fill('What is a balanced meal?');
  await expect(page.getByRole('button', { name: /ask coach fonz/i })).toBeEnabled();
});

test('floating Coach FONZ exposes text-only Mistral and enables draft', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const fab = page.locator('[data-fonz-fab="true"]').first();
  await expect(fab, 'Coach FONZ floating button should be visible').toBeVisible({ timeout: 15_000 });
  await fab.click();
  const panel = page.locator('[data-fonz-panel="true"]').first();
  await expect(panel, 'Coach FONZ floating panel should open').toBeVisible();
  const provider = panel.locator('select').first();
  await expect(provider.locator('option[value="mistral"]')).toHaveCount(1);
  await expect(provider.locator('option[value="mistral"]')).toBeEnabled({ timeout: 15_000 });
  await provider.selectOption('mistral');
  await panel.locator('textarea').first().fill('What is a nutritious snack?');
  await expect(panel.getByRole('button', { name: /send message/i })).toBeEnabled();
  // Deliberately do not send: no cloud credits consumed.
});

test('manual food logging offers Mistral text AI without an analysis call', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const manualButton = page.getByRole('button', { name: /manual/i }).first();
  const manualTab = page.getByRole('tab', { name: /manual/i }).first();
  if (await manualButton.count()) await manualButton.click();
  else if (await manualTab.count()) await manualTab.click();
  else throw new Error('Could not locate the Manual input tab on the signed-in Log Food page.');
  const aiEstimateTool = page.getByRole("group", { name: "Manual logging tools" })
    .getByRole("button", { name: "AI Estimate", exact: true });
  await expect(aiEstimateTool).toBeVisible({ timeout: 15_000 });
  await aiEstimateTool.click();
  const textModel = page.locator('main select').filter({ has: page.locator('option[value="mistral"]') }).first();
  await expect(textModel, 'Manual Text AI must offer Mistral').toBeVisible({ timeout: 15_000 });
  await expect(textModel.locator('option[value="mistral"]')).toBeEnabled();
  await textModel.selectOption('mistral');
  // Deliberately do not click Estimate nutrition with AI.
});