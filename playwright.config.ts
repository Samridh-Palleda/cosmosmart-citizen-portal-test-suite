//! TEST RUNNER CONFIG — wires the projects together.
//! Specs are organised by MODULE folder (auth/, general/, ...). Everything
//! currently runs SIGNED OUT: the citizen portal's only way in is an emailed
//! or texted one-time code, which no test can collect yet — see the note on
//! the `signed-out` project below.
//! Also sets the base URL, timeouts and reporters (the plain-English job
//! summary is only used on CI).

import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config';

export const AUTH_FILE = 'playwright/.auth/citizen.json';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  /*
   * Two locally, one on CI — the same split the CosmoSmart 2.0 suite settled on,
   * and for the same reason: the bottleneck is waiting on a live Azure App
   * Service, not the CPU, so extra workers buy very little and each Chromium
   * costs several hundred MB. CI runners are small, so they get one.
   */
  workers: process.env.CI ? 1 : 2,

  /*
   * Reporters. See https://playwright.dev/docs/test-reporters
   *
   * On CI the goal is that nobody has to download and unzip an artifact to
   * find out what happened:
   *   github          - annotates the failing line directly on the run page
   *   github-summary  - writes a pass/fail table into the run's job summary
   *   html            - the full report, still uploaded as an artifact for
   *                     deep debugging (traces, screenshots)
   *
   * `open: 'never'` matters: the html reporter otherwise starts a local web
   * server when a run fails and holds the terminal open, which looks exactly
   * like a hung test run. Use `npm run report` to view it.
   */
  reporter: process.env.CI
    ? [['github'], ['./reporters/github-summary.ts'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],

  /*
   * The portal is a Vite SPA: the server returns a 1KB shell and React draws
   * everything afterwards, and the city dropdown needs a further API round trip
   * to the CosmoSmart backend on a different host. Nothing is on screen at
   * "page loaded", so assertions get a more realistic window than the 5s default.
   */
  expect: { timeout: 10_000 },

  use: {
    baseURL:
      process.env.BASE_URL ??
      'https://cosmoscitizenapp-b3h4dqh7bte2ezdw.southindia-01.azurewebsites.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },

  projects: [
    /*
     * Everything, in a clean browser with no saved session.
     *
     * The 2.0 suite splits into `setup` / `signed-out` / `signed-in`, where a
     * single `auth.setup.ts` signs in once and saves storageState. There is no
     * equivalent here, by decision: signing in needs a 6-digit code sent to a
     * real inbox or phone, and automating that is OUT OF SCOPE for this suite.
     *
     * So everything behind the sign-in screen is untested, and nothing in this
     * repo should press Send code for real. Keep new specs signed out.
     */
    {
      name: 'signed-out',
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },
  ],
});
