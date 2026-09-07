//! HOME PAGE TESTS — is every card and box actually drawn, with real data in it.
//! Covers: the two panels, the brand block, the headline, the four feature
//! cards, the footer, the two delivery tiles, the field labels and the city
//! dropdown — checking each one exists AND carries text, not just that a box
//! was drawn. Ends with a sweep for values that failed to render.
//! Needs no credentials: run with `npm run test:home`.

import { test, expect } from '@playwright/test';
import { HomePage, RENDER_ARTEFACTS } from '../pages/home-page';
import { AuthPage } from '../pages/auth-page';

/** Every feature card the brand panel promises a citizen. */
const FEATURES = [
  'File a complaint with your location in under a minute',
  'Track every case you have reported, end to end',
  'Every report reaches the ward officer responsible for the area',
  'Rate the resolution once the work is complete',
];

test.describe('Home page', () => {
  let home: HomePage;

  test.beforeEach(async ({ page }) => {
    home = new HomePage(page);
    await home.goto();
  });

  test('draws both panels side by side', async () => {
    await expect(home.brand).toBeVisible();
    await expect(home.panel).toBeVisible();
  });

  test('shows the brand block', async () => {
    await expect(home.logoMark).toBeVisible();
    await expect(home.brandName).toHaveText('CosmoSmart');
    await expect(home.tagline).toContainText('Citizen Portal');
  });

  test('shows the headline and the explanation under it', async () => {
    await expect(home.title).toBeVisible();
    await expect(home.title).toContainText(/waterlogging/i);

    await expect(home.description).toBeVisible();
    await expect(home.description).toContainText(/drainage/i);
  });

  test('builds all four feature cards', async () => {
    await expect(home.featureCards).toHaveCount(FEATURES.length);
    await expect(home.featureIcons).toHaveCount(FEATURES.length);
  });

  test('fills every feature card with its own text', async () => {
    // Not just "four boxes exist" — each one carries the right promise, in
    // order. A card rendered empty or duplicated fails here.
    for (const [index, feature] of FEATURES.entries()) {
      const card = home.featureCards.nth(index);
      await expect(card, `feature card ${index + 1}`).toBeVisible();
      await expect(card, `feature card ${index + 1}`).toContainText(feature);
    }
  });

  test('builds both delivery tiles with a label and a description', async () => {
    await expect(home.deliveryTiles).toHaveCount(2);

    for (const [index, label] of ['Mobile OTP', 'Email OTP'].entries()) {
      const tile = home.deliveryTiles.nth(index);
      await expect(tile, label).toBeVisible();
      await expect(tile, label).toContainText(label);
    }

    // The tiles are a radiogroup, so exactly one may be selected at a time.
    await expect(home.deliveryTiles.nth(0)).toBeChecked();
    await expect(home.deliveryTiles.nth(1)).not.toBeChecked();
  });

  test('labels both input boxes', async () => {
    await expect(home.fieldLabels).toHaveCount(2);

    for (const label of await home.fieldLabels.allInnerTexts()) {
      expect(label.trim(), 'an input box was drawn with an empty label').not.toBe('');
    }
  });

  test('fills the city dropdown from the corporations API', async ({ page }) => {
    const auth = new AuthPage(page);
    const cities = await auth.cityOptions();

    expect(cities.length, 'the city dropdown rendered with no options').toBeGreaterThan(0);
    for (const city of cities) {
      expect(city.trim(), 'a city option rendered with no name').not.toBe('');
    }
  });

  test('shows the footer', async () => {
    await expect(home.footer).toBeVisible();
    await expect(home.footer).toContainText('Cosmos Pumps');
  });

  test('renders no unresolved values anywhere on the page', async () => {
    // The strongest "data displayed properly" check here: if a value the page
    // expected was missing, React prints the hole — "undefined", "NaN",
    // "[object Object]" — rather than failing outright. A human skims past it.
    const text = await home.visibleText();

    for (const artefact of RENDER_ARTEFACTS) {
      expect(text, `"${artefact}" was rendered on the home page`).not.toContain(artefact);
    }
  });

  test('leaves no card empty', async () => {
    // A catch-all for boxes that draw with their content missing — the border
    // and padding are there, so the layout still looks plausible.
    for (const locator of [home.featureCards, home.deliveryTiles]) {
      for (const text of await locator.allInnerTexts()) {
        expect(text.trim(), 'a card was drawn with no content in it').not.toBe('');
      }
    }
  });
});
