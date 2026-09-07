//! PUBLIC PAGE TESTS — what a citizen sees before signing in.
//! Covers: the app actually boots, the marketing panel renders, the page is
//! reachable on a phone, and nothing throws on the way in.
//! Needs no credentials.

import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/auth-page';

test.describe('Public landing', () => {
  test('boots the app rather than serving an empty shell', async ({ page }) => {
    // The server returns a ~1KB Vite shell with an empty <div id="root">, so a
    // 200 proves nothing on its own. This checks React actually drew something.
    const response = await page.goto('/auth');

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('#root')).not.toBeEmpty();
  });

  test('explains what the portal is for', async ({ page }) => {
    await page.goto('/auth');

    await expect(page.getByRole('heading', { level: 1 })).toContainText(/waterlogging/i);
  });

  test('reaches the form without a console error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    const auth = new AuthPage(page);
    await auth.goto();
    await expect(auth.sendCode).toBeVisible();

    expect(errors, `console errors on /auth:\n${errors.join('\n')}`).toEqual([]);
  });

  test('fits a phone screen without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    const auth = new AuthPage(page);
    await auth.goto();
    await expect(auth.sendCode).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflows, 'the page scrolls sideways at 390px').toBe(false);
  });
});
