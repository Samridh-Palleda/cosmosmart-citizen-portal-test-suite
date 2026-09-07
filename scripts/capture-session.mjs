//! CAPTURE A SIGNED-IN SESSION — run this by hand, once, then run the tests.
//! Opens a real browser at the portal and waits while YOU sign in with the
//! one-time code. As soon as you are through, it writes the browser session to
//! playwright/.auth/citizen.json and closes.
//! Nothing in the suite automates the code: this is the manual step that
//! replaces it. Run with `npm run capture-session`.

import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const BASE_URL =
  process.env.BASE_URL ??
  'https://cosmoscitizenapp-b3h4dqh7bte2ezdw.southindia-01.azurewebsites.net';

const AUTH_FILE = 'playwright/.auth/citizen.json';

/** Long enough to open your inbox, find the code and type it in. */
const SIGN_IN_TIMEOUT_MS = 5 * 60_000;

console.log('\nOpening the citizen portal.');
console.log('Sign in as you normally would — the code goes to your own inbox.');
console.log('This window closes by itself the moment you are through.\n');

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE_URL}/auth`);

try {
  // "Sign Out" only exists once the session is real, which makes it a better
  // signal than a URL change — the app also leaves /auth mid-flow to show the
  // code entry step.
  await page
    .getByRole('link', { name: /sign out/i })
    .or(page.getByRole('button', { name: /sign out/i }))
    .first()
    .waitFor({ state: 'visible', timeout: SIGN_IN_TIMEOUT_MS });
} catch {
  console.error(
    `\nNo signed-in page appeared within ${SIGN_IN_TIMEOUT_MS / 60_000} minutes. ` +
      'Nothing was saved — run this again when you have the code to hand.',
  );
  await browser.close();
  process.exit(1);
}

// The tokens live in localStorage (cs_citizen_access / cs_citizen_refresh),
// which storageState captures along with any cookies.
fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
await context.storageState({ path: AUTH_FILE });

const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
const keys = (state.origins ?? []).flatMap((o) => (o.localStorage ?? []).map((i) => i.name));

await browser.close();

if (!keys.includes('cs_citizen_access')) {
  console.error(
    `\nSaved ${AUTH_FILE}, but it has no cs_citizen_access token in it — ` +
      `found: ${keys.join(', ') || '(nothing)'}.\n` +
      'The signed-in tests would fail. Try again, and make sure the home page ' +
      'has finished loading before the window closes.',
  );
  process.exit(1);
}

console.log(`\nSaved ${AUTH_FILE}`);
console.log(`Stored keys: ${keys.join(', ')}`);
console.log('\nThe signed-in tests will now pick this up. Run: npm test');
console.log(
  'The session is a real login — treat the file as a credential. It is gitignored.\n',
);
