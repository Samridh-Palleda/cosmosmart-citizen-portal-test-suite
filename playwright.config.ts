//! TEST RUNNER CONFIG — wires the projects together.
//! Specs are organised by MODULE folder (auth/, general/, ...). Everything
//! currently runs SIGNED OUT: the citizen portal's only way in is an emailed
//! or texted one-time code, which no test can collect yet — see the note on
//! the `signed-out` project below.
//! Also sets the base URL, timeouts and reporters (the plain-English job
//! summary is only used on CI).

import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import 'dotenv/config';

export const AUTH_FILE = 'playwright/.auth/citizen.json';

/*
 * Signing in needs a 6-digit code from a real inbox, and automating that is out
 * of scope. Instead `npm run capture-session` opens a browser, waits for a
 * human to sign in, and saves the session here — so the manual step happens
 * once, by hand, rather than on every run.
 *
 * Without that file the signed-in project is left out entirely: a project whose
 * storageState is missing fails at browser-launch with an unhelpful error, and
 * a suite that cannot possibly pass should not pretend to run.
 */
const hasSession = fs.existsSync(AUTH_FILE);

if (!hasSession && !process.env.CI) {
  console.warn(
    `\n  No ${AUTH_FILE} — skipping the signed-in tests.` +
      '\n  Run `npm run capture-session` to sign in once and record a session.\n',
  );
}

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
     * The public screens, in a clean browser with no saved session.
     * Nothing in here should ever press Send code for real.
     */
    {
      name: 'signed-out',
      testIgnore: /signed-in\//,
      use: { ...devices['Desktop Chrome'], storageState: { cookies: [], origins: [] } },
    },

    /*
     * Everything behind the sign-in, replaying the session captured by hand.
     *
     * ONE worker, unlike the signed-out project. The app holds a refresh token
     * that rotates on use (see the "cosmosmart-citizen-refresh" lock in the
     * bundle): two workers replaying the same saved token can both try to
     * refresh it, one rotation wins, and the loser is logged out mid-test. A
     * single worker cannot race itself.
     */
    ...(hasSession
      ? [
          {
            name: 'signed-in',
            testMatch: /signed-in\//,
            workers: 1,
            use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
          },
        ]
      : []),
  ],
});
