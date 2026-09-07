//! SHARED HELPERS — the only file that knows how the signed-in home page is built.
//! Holds the page object for the header, the main nav, the welcome hero, the
//! three stat cards, the recent-complaints list, "How it works" and the
//! account card.
//! When the app's markup changes, this is the only file that needs updating.

import { Page, Locator, expect } from '@playwright/test';

/** The signed-in home page lives at the root once a session exists. */
export const HOME_PATH = '/';

/** GET — the complaints the home page counts and lists. */
export const COMPLAINTS_API = '**/api/public/grievance/complaints';

/** Every section the main nav must offer, and where each one goes. */
export const NAV_ITEMS = [
  { name: 'Home', href: '/' },
  { name: 'File Complaint', href: '/file' },
  { name: 'My Complaints', href: '/complaints' },
  { name: 'Updates', href: '/updates' },
  { name: 'Profile', href: '/profile' },
] as const;

/** The three summary tiles, in the order the page lays them out. */
export const STAT_CARDS = ['Total reported', 'Still open', 'Completed'] as const;

/**
 * Strings that mean something failed to render rather than something the
 * copywriter wrote. If any reach the screen, a value the page expected was
 * missing and the template printed the hole instead.
 */
export const RENDER_ARTEFACTS = ['undefined', 'NaN', '[object Object]', '{{', 'Infinity'];

/**
 * The citizen's home page, as seen with a real session.
 *
 * The page is well built for testing: a banner, a named navigation landmark,
 * real headings and links. Locators here are role-based wherever the app gives
 * a role, and fall back to class names only for the presentational tiles
 * (.stat-card, .complaint-item) which are plain divs inside a button or link.
 */
export class HomePage {
  readonly brand: Locator;
  readonly brandName: Locator;
  readonly corporation: Locator;
  readonly userPill: Locator;
  readonly userName: Locator;

  readonly nav: Locator;
  readonly navItems: Locator;
  readonly signOut: Locator;

  readonly greeting: Locator;
  readonly title: Locator;
  readonly subtitle: Locator;
  readonly fileComplaintCta: Locator;

  readonly statCards: Locator;

  readonly recentComplaintsCard: Locator;
  readonly complaintItems: Locator;
  readonly viewAll: Locator;

  readonly howItWorksCard: Locator;
  readonly howItWorksSteps: Locator;

  readonly accountCard: Locator;
  readonly accountValues: Locator;
  readonly viewProfile: Locator;

  readonly footer: Locator;

  constructor(public readonly page: Page) {
    this.brand = page.getByRole('button', { name: 'CosmoSmart Citizen home' });
    this.brandName = page.locator('.brand-name');
    this.corporation = page.locator('.brand-loc');
    this.userPill = page.getByRole('button', { name: 'Your profile' });
    this.userName = page.locator('.user-name');

    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.navItems = this.nav.getByRole('link');
    this.signOut = this.nav.getByRole('button', { name: 'Sign Out' });

    this.greeting = page.locator('.hero-greeting');
    this.title = page.getByRole('heading', { level: 1 });
    this.subtitle = page.locator('.hero-sub');
    this.fileComplaintCta = page.getByRole('button', { name: 'File a new complaint' });

    this.statCards = page.locator('.stat-card');

    this.recentComplaintsCard = page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Your recent complaints' }) });
    this.complaintItems = page.locator('.complaint-item');
    this.viewAll = this.recentComplaintsCard.getByRole('link', { name: 'View all' });

    this.howItWorksCard = page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'How it works' }) });
    this.howItWorksSteps = this.howItWorksCard.getByRole('listitem');

    this.accountCard = page
      .locator('.card')
      .filter({ has: page.getByRole('heading', { name: 'Your account' }) });
    // Two rows, each "label" then a bold value: the city, then who is signed in.
    this.accountValues = this.accountCard.locator('strong');
    this.viewProfile = this.accountCard.getByRole('button', { name: 'View profile' });

    this.footer = page.locator('.app-footer');
  }

  async goto() {
    await this.page.goto(HOME_PATH);
    await expect(this.title).toBeVisible();
    await this.waitForData();
  }

  /**
   * Wait until the dashboard has its real numbers.
   *
   * The hero renders immediately, but the three tiles show an em dash while the
   * complaints API is in flight — measured at roughly 2 seconds against the
   * live backend, on a call that goes to a different host. Asserting before
   * that lands compares against "—" and fails for no good reason.
   *
   * Deliberately waits on the rendered value rather than the network response:
   * this proves the page actually put the data on screen, which is the thing
   * under test.
   */
  async waitForData() {
    await expect(
      this.statCards.first().locator('.stat-value'),
      'the stat tiles never replaced their loading placeholder',
    ).toHaveText(/^\d+$/);
  }

  /** One stat tile, by its visible label. */
  stat(label: (typeof STAT_CARDS)[number]): Locator {
    return this.statCards.filter({ hasText: label });
  }

  /**
   * The number shown on a stat tile.
   * Throws rather than returning NaN, so a blank tile fails with a readable
   * message instead of an arithmetic comparison against nothing.
   */
  async statValue(label: (typeof STAT_CARDS)[number]): Promise<number> {
    const raw = (await this.stat(label).locator('.stat-value').innerText()).trim();
    const value = Number(raw);
    if (!Number.isInteger(value)) {
      throw new Error(`"${label}" tile shows ${JSON.stringify(raw)}, which is not a whole number`);
    }
    return value;
  }

  /** Everything the page renders as text, for artefact scanning. */
  async visibleText(): Promise<string> {
    return this.page.locator('main').innerText();
  }
}
