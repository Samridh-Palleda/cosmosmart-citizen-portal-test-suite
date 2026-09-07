import { test as base, expect } from '@playwright/test';

/**
 * Extend this with page-object fixtures as the suite grows, e.g.
 *   loginPage: async ({ page }, use) => { await use(new LoginPage(page)); }
 */
export type PortalFixtures = Record<string, never>;

export const test = base.extend<PortalFixtures>({});
export { expect };
