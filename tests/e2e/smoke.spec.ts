import { test, expect } from '@fixtures/test-fixtures';

test.describe('Citizen portal — smoke', () => {
  test('home page loads and responds with a successful status', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status(), 'home page should return a 2xx status').toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test('home page renders a main landmark', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('body')).toBeVisible();
  });
});
