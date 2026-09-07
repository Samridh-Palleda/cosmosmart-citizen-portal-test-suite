import { Page, Locator, expect } from '@playwright/test';

/**
 * Shared behaviour for every page object in the suite.
 * Concrete pages declare their own locators and expose intent-revealing actions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /** Path relative to baseURL, e.g. '/login'. */
  protected abstract readonly path: string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`${this.path}$`));
  }

  protected byRole(role: Parameters<Page['getByRole']>[0], name: string | RegExp): Locator {
    return this.page.getByRole(role, { name });
  }
}
