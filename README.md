# CosmoSmart Citizen Portal — Test Suite

Playwright + TypeScript end-to-end tests for the CosmoSmart citizen portal.

## Setup

```bash
npm install
npx playwright install
cp .env.example .env   # then fill in BASE_URL and test credentials
```

## Running

```bash
npm test                 # all projects
npm run test:chromium    # chromium only
npm run test:ui          # interactive UI mode
npm run test:headed      # headed browsers
npm run report           # open the last HTML report
npm run typecheck        # tsc, no emit
```

## Layout

| Path        | Purpose                                          |
| ----------- | ------------------------------------------------ |
| `tests/`    | Specs, grouped by feature under `tests/e2e/`     |
| `pages/`    | Page objects (extend `BasePage`)                 |
| `fixtures/` | Custom Playwright fixtures and the shared `test` |
| `utils/`    | Helpers, environment access                      |
| `test-data/`| Static fixtures and seed data                    |

Import via path aliases: `@pages/*`, `@fixtures/*`, `@utils/*`, `@test-data/*`.

## Conventions

- Import `test` and `expect` from `@fixtures/test-fixtures`, not `@playwright/test`.
- Prefer role- and label-based locators over CSS/XPath.
- Use web-first assertions (`await expect(locator).toBeVisible()`); no manual waits.
- Keep specs free of raw selectors — they belong in page objects.
