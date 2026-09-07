//! SHARED HELPERS — the only file that knows how the home page is laid out.
//! Holds the page object for the brand panel (logo, headline, the four feature
//! cards, the footer) and the two delivery tiles.
//! When the app's markup changes, this is the only file that needs updating.

import { Page, Locator } from '@playwright/test';

/**
 * The portal's home page.
 *
 * For a signed-out visitor `/` IS this screen: React Router redirects it to
 * `/auth`, and the only other routes in the bundle (complaints, file, profile,
 * updates) sit behind the sign-in. So the marketing panel and the sign-in card
 * together are the whole public front door.
 *
 * Most of this panel is presentational — plain divs with no ARIA role — so
 * unlike AuthPage the locators here have to reach for class names. Only the
 * headline and the delivery tiles carry real roles, and those use them.
 */
export class HomePage {
  readonly brand: Locator;
  readonly panel: Locator;
  readonly logoMark: Locator;
  readonly brandName: Locator;
  readonly tagline: Locator;
  readonly title: Locator;
  readonly description: Locator;
  readonly featureCards: Locator;
  readonly featureIcons: Locator;
  readonly footer: Locator;
  readonly deliveryTiles: Locator;
  readonly fieldLabels: Locator;

  constructor(public readonly page: Page) {
    this.brand = page.locator('.auth-brand');
    this.panel = page.locator('.auth-panel');

    this.logoMark = page.locator('.auth-logo-mark');
    this.brandName = page.locator('.auth-brand-name');
    this.tagline = page.locator('.auth-brand-tagline');

    // The headline is a real <h1>; everything around it is not.
    this.title = page.getByRole('heading', { level: 1 });
    this.description = page.locator('.auth-brand-desc');

    this.featureCards = page.locator('.auth-feat');
    this.featureIcons = page.locator('.auth-feat-icon');
    this.footer = page.locator('.auth-brand-footer');

    // The two "how to receive your code" tiles are proper radios.
    this.deliveryTiles = page.getByRole('radio');

    this.fieldLabels = page.locator('.field-label');
  }

  async goto() {
    // Deliberately '/', not '/auth' — this exercises the redirect a citizen
    // actually goes through when they type the portal's address.
    await this.page.goto('/');
  }

  /** Everything the page renders as text, for artefact scanning. */
  async visibleText(): Promise<string> {
    return this.page.locator('body').innerText();
  }
}

/**
 * Strings that mean something failed to render rather than something the
 * copywriter wrote. If any of these reach the screen, a value the page expected
 * was missing and the template printed the hole instead.
 */
export const RENDER_ARTEFACTS = [
  'undefined',
  'null',
  'NaN',
  '[object Object]',
  '{{',
  'Infinity',
];
