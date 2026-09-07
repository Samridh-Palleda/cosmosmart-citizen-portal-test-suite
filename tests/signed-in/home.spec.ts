//! SIGNED-IN HOME PAGE TESTS — every card and box on the citizen's dashboard.
//! Covers: the header, the main nav, the welcome hero, the three stat tiles,
//! the recent-complaints list, "How it works", the account card and the footer
//! — checking each box exists AND carries real content.
//! Asserts on SHAPE and CONSISTENCY, never on this account's numbers: the
//! counts must agree with each other and with the list, so the tests keep
//! working as complaints are filed and closed.
//! Needs a session — run `npm run capture-session` first.

import { test, expect } from '@playwright/test';
import {
  HomePage,
  NAV_ITEMS,
  STAT_CARDS,
  RENDER_ARTEFACTS,
  COMPLAINTS_API,
} from '../pages/home-page';

test.describe('Signed-in home page', () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    await home.goto();
  });

  // --- Header and navigation -------------------------------------------------

  test('shows the portal name and the citizen\'s corporation', async () => {
    await expect(home.brand).toBeVisible();
    await expect(home.brandName).toHaveText('CosmoSmart Citizen');

    const corporation = (await home.corporation.innerText()).trim();
    expect(corporation, 'the header shows no corporation').not.toBe('');
  });

  test('shows who is signed in', async () => {
    await expect(home.userPill).toBeVisible();

    const name = (await home.userName.innerText()).trim();
    expect(name, 'the header shows no citizen name').not.toBe('');
  });

  test('offers every section in the main nav', async () => {
    await expect(home.navItems).toHaveCount(NAV_ITEMS.length);

    for (const { name, href } of NAV_ITEMS) {
      const item = home.nav.getByRole('link', { name });
      await expect(item, name).toBeVisible();
      await expect(item, name).toHaveAttribute('href', href);
    }

    await expect(home.signOut).toBeVisible();
  });

  test('marks Home as the section you are on', async () => {
    await expect(home.nav.getByRole('link', { name: 'Home' })).toHaveClass(/active/);
  });

  // --- Welcome hero ----------------------------------------------------------

  test('greets the citizen by name', async () => {
    await expect(home.greeting).toContainText('Namaste');
    await expect(home.title).toBeVisible();

    // The hero greets by first name; the header shows the full name. If they
    // disagree, the page is showing one citizen's name to another's session.
    const [firstName] = (await home.userName.innerText()).trim().split(/\s+/);
    await expect(home.title).toContainText(firstName);
  });

  test('explains what the portal is for and offers the main action', async () => {
    await expect(home.subtitle).not.toBeEmpty();
    await expect(home.fileComplaintCta).toBeVisible();
    await expect(home.fileComplaintCta).toBeEnabled();
  });

  // --- Stat tiles ------------------------------------------------------------

  test('builds all three stat tiles', async () => {
    await expect(home.statCards).toHaveCount(STAT_CARDS.length);

    for (const label of STAT_CARDS) {
      await expect(home.stat(label), label).toBeVisible();
    }
  });

  test('fills every stat tile with a label, a number and a caption', async () => {
    for (const label of STAT_CARDS) {
      const card = home.stat(label);
      await expect(card.locator('.stat-label'), label).toHaveText(label);
      await expect(card.locator('.stat-value'), label).not.toBeEmpty();
      await expect(card.locator('.stat-change'), label).not.toBeEmpty();
    }
  });

  test('shows a whole number on every stat tile', async () => {
    for (const label of STAT_CARDS) {
      // statValue() throws on anything that is not an integer, so a tile
      // showing "-", "NaN" or nothing at all fails here with its own name.
      expect(await home.statValue(label), label).toBeGreaterThanOrEqual(0);
    }
  });

  test('the stat tiles add up', async () => {
    // The strongest data check on this page: whatever the numbers are, every
    // complaint is either still open or completed. If these stop agreeing, the
    // citizen is being shown a total that does not match its own breakdown.
    const total = await home.statValue('Total reported');
    const open = await home.statValue('Still open');
    const completed = await home.statValue('Completed');

    expect(open + completed, `still open (${open}) + completed (${completed}) should equal total reported (${total})`).toBe(total);
  });

  // --- Recent complaints -----------------------------------------------------

  test('shows the recent complaints card', async () => {
    await expect(home.recentComplaintsCard).toBeVisible();
    await expect(home.viewAll).toHaveAttribute('href', '/complaints');
  });

  test('never lists more complaints than the citizen has filed', async () => {
    const total = await home.statValue('Total reported');
    expect(await home.complaintItems.count()).toBeLessThanOrEqual(total);
  });

  test('gives every listed complaint a reference, a location and a status', async () => {
    const count = await home.complaintItems.count();
    test.skip(count === 0, 'this account has filed no complaints yet');

    for (let index = 0; index < count; index++) {
      const item = home.complaintItems.nth(index);
      const where = `complaint ${index + 1}`;

      await expect(item.locator('.complaint-title'), where).not.toBeEmpty();
      // Reference reads like "GRV-3 · Sector 32, Faridabad ... · 3 days ago".
      await expect(item.locator('.complaint-meta'), where).toContainText(/GRV-\d+/);
      await expect(item.locator('.badge'), where).not.toBeEmpty();
    }
  });

  test('links every listed complaint to its own page', async () => {
    const count = await home.complaintItems.count();
    test.skip(count === 0, 'this account has filed no complaints yet');

    const hrefs = await home.complaintItems.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href')),
    );

    for (const href of hrefs) {
      expect(href, 'a complaint links nowhere').toMatch(/^\/complaints\/GRV-\d+$/);
    }
    expect(new Set(hrefs).size, 'two complaints link to the same page').toBe(hrefs.length);
  });

  // --- Supporting cards ------------------------------------------------------

  test('explains how the service works in four steps', async () => {
    await expect(home.howItWorksCard).toBeVisible();
    await expect(home.howItWorksSteps).toHaveCount(4);

    for (const step of await home.howItWorksSteps.allInnerTexts()) {
      expect(step.trim(), 'a "How it works" step is empty').not.toBe('');
    }
  });

  test('shows the account card, agreeing with the header', async () => {
    await expect(home.accountCard).toBeVisible();
    await expect(home.accountValues).toHaveCount(2);
    await expect(home.viewProfile).toBeVisible();

    // Same two facts as the header, drawn from the same session. They must match.
    const [city, name] = await home.accountValues.allInnerTexts();
    expect(city.trim()).toBe((await home.corporation.innerText()).trim());
    expect(name.trim()).toBe((await home.userName.innerText()).trim());
  });

  test('shows the footer', async () => {
    await expect(home.footer).toBeVisible();
    await expect(home.footer).toContainText('Cosmos Pumps');
  });

  // --- Whole-page checks -----------------------------------------------------

  test('renders no unresolved values anywhere on the page', async () => {
    // If a value the page expected was missing, React prints the hole -
    // "undefined", "NaN", "[object Object]" - rather than failing. The layout
    // still looks right, so this is easy to miss by eye.
    const text = await home.visibleText();

    for (const artefact of RENDER_ARTEFACTS) {
      expect(text, `"${artefact}" was rendered on the home page`).not.toContain(artefact);
    }
  });

  test('leaves no card empty', async () => {
    // A catch-all for boxes that draw with their content missing: the border
    // and padding are there, so the layout still looks plausible.
    for (const locator of [home.statCards, home.complaintItems]) {
      for (const text of await locator.allInnerTexts()) {
        expect(text.trim(), 'a card was drawn with no content in it').not.toBe('');
      }
    }
  });

  test('still renders the page when the complaints service is down', async ({ page }) => {
    await page.route(COMPLAINTS_API, (route) => route.abort('failed'));
    await page.reload();

    // The citizen must still get a usable page and a way to report a problem,
    // rather than a blank screen, when the backend cannot be reached.
    await expect(home.title).toBeVisible();
    await expect(home.fileComplaintCta).toBeVisible();
    await expect(home.nav).toBeVisible();
  });
});
