//! SIGN-IN / CREATE ACCOUNT FORM TESTS — everything before a code is sent.
//! Covers: the form renders, the two delivery channels, the city dropdown,
//! which inputs each tab shows, and the validation that keeps Send code
//! switched off.
//! Stops deliberately at the point of sending. Pressing Send code for real
//! mails or texts a live person, so the only test that touches it intercepts
//! the request first and proves an empty form never leaves the browser.
//! Needs no credentials: run with `npm run test:auth`.

import { test, expect } from '@playwright/test';
import { AuthPage, SEND_OTP_API, CORPORATIONS_API } from '../pages/auth-page';

test.describe('Auth form', () => {
  let auth: AuthPage;

  test.beforeEach(async ({ page }) => {
    auth = new AuthPage(page);
    await auth.goto();
  });

  test('renders the sign-in form', async ({ page }) => {
    await expect(auth.heading).toHaveText('Welcome back');
    await expect(auth.signInTab).toHaveAttribute('aria-selected', 'true');
    await expect(auth.createAccountTab).toBeVisible();
    await expect(auth.channelGroup).toBeVisible();
    await expect(auth.city).toBeVisible();
    await expect(page).toHaveTitle(/CosmoSmart Citizen/);

    // Send code starts switched off until there is something to submit.
    await expect(auth.sendCode).toBeDisabled();
  });

  test('sends citizens to /auth from the front page', async ({ page }) => {
    // A client-side redirect, not an HTTP 302 — only a real browser follows it.
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth$/);
  });

  test('offers SMS and email, and starts on SMS', async () => {
    await expect(auth.mobileChannel).toBeChecked();
    await expect(auth.emailChannel).not.toBeChecked();
    await expect(auth.mobile).toBeVisible();
  });

  test('switching to email swaps the mobile box for an email box', async () => {
    await auth.chooseChannel('email');

    await expect(auth.email).toBeVisible();
    await expect(auth.mobile).toBeHidden();
  });

  test('switching back to SMS restores the mobile box', async () => {
    await auth.chooseChannel('email');
    await auth.chooseChannel('mobile');

    await expect(auth.mobile).toBeVisible();
    await expect(auth.email).toBeHidden();
  });

  test('lists the cities the portal serves', async () => {
    const cities = await auth.cityOptions();

    expect(cities.length).toBeGreaterThan(0);
    expect(cities.join(' | ')).toContain('Faridabad');
  });

  test('Create Account asks for a name as well', async () => {
    await auth.createAccountTab.click();

    await expect(auth.heading).toHaveText('Create your account');
    await expect(auth.fullName).toBeVisible();
  });

  test('remembers the chosen channel when switching tabs', async () => {
    await auth.chooseChannel('email');
    await auth.createAccountTab.click();

    await expect(auth.emailChannel).toBeChecked();
    await expect(auth.email).toBeVisible();
  });

  test('will not send a code to an empty mobile box', async () => {
    await expect(auth.sendCode).toBeDisabled();
  });

  test('will not send a code to an empty email box', async () => {
    await auth.chooseChannel('email');

    await expect(auth.sendCode).toBeDisabled();
  });

  test('enables Send code once a full mobile number is typed', async () => {
    await auth.mobile.fill('9876543210');

    await expect(auth.sendCode).toBeEnabled();
  });

  test('enables Send code once an email address is typed', async () => {
    await auth.chooseChannel('email');
    await auth.email.fill('citizen@example.com');

    await expect(auth.sendCode).toBeEnabled();
  });

  test('an empty form never reaches the server', async ({ page }) => {
    let called = false;
    await page.route(SEND_OTP_API, (route) => {
      called = true;
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: '{"error":"x"}',
      });
    });

    // force: the button is disabled, so a normal click would just time out.
    // This proves the guard is real and not only a visual state.
    await auth.sendCode.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);

    expect(called, 'the send-code API was called with an empty form').toBe(false);
  });

  // KNOWN DEFECT — remove test.fail() once fixed.
  // When the corporations API cannot be reached the city dropdown renders with
  // ZERO options, but Send code stays enabled and submits anyway, falling back
  // to the corporation baked into the build (VITE_DEFAULT_CORPORATION, MCF-FBD).
  // So a citizen in Pune on a patchy connection is silently filed under
  // Faridabad, with an empty dropdown giving them no way to see it or correct
  // it — and their report would reach the wrong municipal corporation.
  test.fail('does not send a code when no city could be loaded', async ({ page }) => {
    let sent: string | null = null;
    await page.route(SEND_OTP_API, (route) => {
      sent = route.request().postData();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"expiresInSeconds":300}',
      });
    });
    await page.route(CORPORATIONS_API, (route) => route.abort('failed'));
    await page.reload();

    await expect(auth.city.locator('option')).toHaveCount(0);

    await auth.mobile.fill('9876543210');
    await auth.sendCode.click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(2000);

    expect(sent, 'a code was sent against a city the citizen never chose').toBeNull();
  });
});
