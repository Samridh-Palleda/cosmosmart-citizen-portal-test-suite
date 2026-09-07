# CosmoSmart Citizen — Playwright test suite

Functional coverage of the **CosmoSmart Citizen portal**, the public-facing site
where residents report waterlogging and drainage problems, track how they are
resolved, and rate the work. Built to the same conventions as the
[CosmoSmart 2.0 suite](https://github.com/cosmos-pumps/cosmosmart2.0-test-suite),
which covers the staff-facing dashboard on the same backend.

18 tests today, all of them against the sign-in and registration screen and the
public landing page. **Read-only: the suite never sends a real one-time code.**

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env    # optional — only needed to point at a different BASE_URL
```

No account or credentials are required. See [Why nothing signs in](#why-nothing-signs-in).

## Running

```bash
npm test              # everything (~35s)
npm run test:auth     # the sign-in / registration form only
npm run test:landing  # the public page only
npm run test:watch    # headed, ONE worker — watch tests run one at a time
npm run test:ui       # interactive runner
npm run report        # open the last HTML report
```

### Running one file

Pass any part of the filename:

```bash
npx playwright test auth-form.spec.ts
```

## Layout

| Path                  | What is in it                                          |
| --------------------- | ------------------------------------------------------ |
| `tests/auth/`         | The sign-in and Create Account form                    |
| `tests/general/`      | The public landing page, phone layout, console errors  |
| `tests/pages/`        | Page objects — the only files that know the markup     |
| `reporters/`          | Plain-English GitHub Actions job summary               |

## Why nothing signs in

The CosmoSmart 2.0 suite signs in once in `auth.setup.ts`, saves the browser
session, and runs everything else already authenticated. **This suite does not
sign in at all.** The citizen portal has no password — the only way in is a
6-digit code sent by SMS or email to a real phone or inbox — and automating
that is **out of scope by decision**.

Two consequences:

- Every spec runs in the single `signed-out` project, and everything behind the
  sign-in screen is untested. Coverage stops at the auth form.
- **Tests must never actually press Send code.** Against this deployment that
  mails or texts a real person, costs money, and is rate limited. The only test
  that touches the button intercepts the request with `page.route()` first, to
  prove an empty form never leaves the browser.

## The app under test

A Vite + React single-page app. The server returns a ~1KB shell with an empty
`<div id="root">` and React draws everything afterwards, so an HTTP `200` proves
nothing on its own — `tests/general/landing.spec.ts` checks the app actually
booted. `/` client-redirects to `/auth` via React Router, not an HTTP 302, so
only a real browser follows it.

Data comes from the CosmoSmart backend on a **different host**
(`cosmossmart.azurewebsites.net`) — the same API the 2.0 dashboard is tested
against:

| Endpoint                                  | Used for                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `GET  /api/public/grievance/corporations` | The "Your city" dropdown                            |
| `POST /api/public/grievance/otp`          | Sending a code — intercepted, never called for real |

The screen is properly labelled — real tabs, a named radiogroup, a labelled
combobox — so every locator is role-based and none reach for a CSS class. No
`data-testid` attributes are needed on this account.

## Known issues

One test is marked `test.fail()`. It documents a real defect on purpose, so the
run stays green until somebody fixes it — at which point it goes red to say the
marker needs removing.

**A code is sent for a city nobody chose.** When the corporations API cannot be
reached the city dropdown renders with zero options, but `Send code` stays
enabled and submits anyway, falling back to the corporation baked into the build
(`VITE_DEFAULT_CORPORATION`, `MCF-FBD`). A citizen in Pune on a patchy
connection is silently filed under Faridabad, with an empty dropdown giving them
no way to see it or correct it — and their report would reach the wrong
municipal corporation.

## CI

`.github/workflows/playwright.yml` runs **manually only** — click *Run workflow*
in the Actions tab. It does not trigger on push or pull request, because the
org's Actions minutes are limited.

A preflight step curls the site before installing anything, so an Azure App
Service that has been stopped or scaled to zero fails the run in about a minute
instead of twenty. Results are written into the run's job summary in plain
English by `reporters/github-summary.ts`; the HTML report and failure traces are
uploaded as artifacts for deeper debugging.
