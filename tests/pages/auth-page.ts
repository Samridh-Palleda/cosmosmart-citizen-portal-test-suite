//! SHARED HELPERS — the only file that knows how the /auth screen is built.
//! Holds the page object (tabs, channel radios, city dropdown, the identity
//! box, Send code) and AUTH_PATH.
//! When the app's markup changes, this is the only file that needs updating.

import { Page, Locator, expect } from '@playwright/test';

/**
 * Where the sign-in screen lives.
 *
 * `/` does not serve it: the SPA client-redirects to `/auth` once React boots.
 * That is a React Router redirect, not an HTTP 302, so `curl -L` never sees it.
 * Navigating straight here skips the redirect and one render pass.
 */
export const AUTH_PATH = '/auth';

/** The two ways the portal will send a one-time code. */
export type Channel = 'mobile' | 'email';

/**
 * The one place that knows how the citizen sign-in screen is put together.
 *
 * Unlike the CosmoSmart 2.0 dashboard, this app is properly labelled — real
 * tabs, a named radiogroup, a labelled combobox — so every locator below is
 * role-based and none of them reach for a CSS class. No data-testid attributes
 * are needed, and none should be added on this account.
 */
export class AuthPage {
  readonly signInTab: Locator;
  readonly createAccountTab: Locator;
  readonly channelGroup: Locator;
  readonly mobileChannel: Locator;
  readonly emailChannel: Locator;
  readonly city: Locator;
  readonly fullName: Locator;
  readonly email: Locator;
  readonly mobile: Locator;
  readonly sendCode: Locator;
  readonly heading: Locator;

  constructor(public readonly page: Page) {
    this.signInTab = page.getByRole('tab', { name: 'Sign In' });
    this.createAccountTab = page.getByRole('tab', { name: 'Create Account' });

    this.channelGroup = page.getByRole('radiogroup', { name: 'How to receive your code' });
    this.mobileChannel = page.getByRole('radio', { name: /Mobile OTP/ });
    this.emailChannel = page.getByRole('radio', { name: /Email OTP/ });

    this.city = page.getByRole('combobox', { name: 'Your city' });
    this.fullName = page.getByRole('textbox', { name: 'Full name' });
    this.email = page.getByRole('textbox', { name: 'Email address' });
    this.mobile = page.getByRole('textbox', { name: 'Mobile number' });

    this.sendCode = page.getByRole('button', { name: 'Send code' });

    // Switches between "Welcome back" and "Create your account" with the tab,
    // so it is matched by role and level rather than by its text.
    this.heading = page.getByRole('heading', { level: 2 });
  }

  async goto() {
    await this.page.goto(AUTH_PATH);
    await expect(this.heading).toBeVisible();
  }

  /** Pick how the code should be delivered. Selection survives a tab switch. */
  async chooseChannel(channel: Channel) {
    const radio = channel === 'email' ? this.emailChannel : this.mobileChannel;
    await radio.click();
    await expect(radio).toBeChecked();
  }

  /** The identity box for the currently selected channel. */
  identityField(channel: Channel): Locator {
    return channel === 'email' ? this.email : this.mobile;
  }

  /**
   * The city dropdown is filled from the CosmoSmart backend on a different
   * host, so it starts empty and populates a moment later. Waits for real
   * options rather than asserting against a half-built select.
   */
  async cityOptions(): Promise<string[]> {
    await expect
      .poll(async () => this.city.locator('option').count(), {
        message: 'city dropdown never populated from the corporations API',
      })
      .toBeGreaterThan(0);
    return this.city.locator('option').allInnerTexts();
  }

  /** The live region the form announces errors and confirmations through. */
  get status(): Locator {
    return this.page.locator('[role="status"]');
  }
}

/*
 * The backend endpoints this screen talks to, read out of the built bundle.
 *
 * They sit on the CosmoSmart API host (VITE_API_BASE_URL), NOT on the portal's
 * own origin — the same backend the CosmoSmart 2.0 dashboard is tested against.
 * Matched by suffix so a staging API base URL still hits these routes.
 */

/** GET — fills the city dropdown. */
export const CORPORATIONS_API = '**/api/public/grievance/corporations';

/**
 * POST — sends a real one-time code by SMS or email.
 *
 * Tests must never let a call reach this for real: it costs money, it is rate
 * limited, and against this deployment it mails or texts an actual person.
 * Always intercept it with page.route().
 */
export const SEND_OTP_API = '**/api/public/grievance/otp';
