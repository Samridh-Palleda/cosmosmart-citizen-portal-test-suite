# CosmoSmart Citizen — Playwright test suite

Functional coverage of the **CosmoSmart Citizen portal**, the public-facing site
where residents report waterlogging and drainage problems, track how they are
resolved, and rate the work. Built to the same conventions as the
[CosmoSmart 2.0 suite](https://github.com/cosmos-pumps/cosmosmart2.0-test-suite),
which covers the staff-facing dashboard on the same backend.

37 tests today: the signed-in home page, the sign-in and registration screen,
and the public page health checks. **Read-only: the suite never sends a real
one-time code and never files a complaint.**

## Setup

```bash
npm install
npx playwright install chromium
cp .env.example .env    # optional — only needed to point at a different BASE_URL
```

The public specs need no account. The signed-in specs need a session recorded
once by hand — see [How the signed-in tests get in](#how-the-signed-in-tests-get-in).

## Running

```bash
npm run capture-session  # sign in by hand once — needed for the signed-in tests
npm test              # everything
npm run test:home     # the signed-in home page only
npm run test:auth     # the sign-in / registration form only
npm run test:landing  # app health, console errors, phone layout
npm run test:headed   # headed, ONE worker — watch tests run one at a time
npm run test:ui       # interactive runner
npm run report        # open the last HTML report
```

`test:headed` pins `--workers=1` on purpose. The point of a headed run is to
watch it, and with the default two workers Playwright opens two browser windows
that race each other across the screen — unreadable. One worker runs the specs
one at a time, in order.

### Running one file

Pass any part of the filename:

```bash
npx playwright test auth-form.spec.ts
```

## Layout

| Path                  | What is in it                                          |
| --------------------- | ------------------------------------------------------ |
| `tests/signed-in/`    | Pages behind the sign-in — needs a captured session    |
| `tests/auth/`         | The sign-in and Create Account form                    |
| `tests/general/`      | The public landing page, phone layout, console errors  |
| `tests/pages/`        | Page objects — the only files that know the markup     |
| `reporters/`          | Plain-English GitHub Actions job summary               |

## How the signed-in tests get in

The CosmoSmart 2.0 suite signs in once in `auth.setup.ts` and saves the browser
session. This portal has no password — the only way in is a 6-digit code sent to
a real inbox or phone — and **automating that is out of scope by decision**.

So the sign-in happens **once, by hand**:

```bash
npm run capture-session
```

That opens a real browser. You sign in as you normally would, the code goes to
your own inbox, and the script saves the session to
`playwright/.auth/citizen.json` the moment it sees you are through. Everything
in `tests/signed-in/` then replays it. The file is a real login — treat it as a
credential; it is gitignored.

Three things follow:

- **Without that file the signed-in project is not registered at all.** A
  missing `storageState` makes Playwright fail at browser launch with an
  unhelpful error, so `playwright.config.ts` leaves the project out and prints a
  note telling you to capture a session. `npm test` still runs the public specs.
- **Signed-in specs run on one worker.** The app holds a refresh token that
  rotates on use. Two workers replaying the same saved token would both try to
  refresh it, one rotation wins, and the loser is signed out mid-test.
- **The session expires.** How long it lasts has not been measured. When the
  signed-in specs start failing on a redirect to `/auth`, run
  `capture-session` again.

**Tests must never actually press Send code.** Against this deployment that
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
| `GET  /api/public/grievance/complaints`   | The stat tiles and the recent-complaints list        |

The app is well built for testing — real tabs, a named radiogroup, a labelled
combobox, a banner, a named `navigation` landmark, proper headings and links —
so `tests/pages/auth-page.ts` is entirely role-based and no `data-testid`
attributes are needed.

`tests/pages/home-page.ts` is mostly role-based too, but falls back to class
names for the presentational tiles inside a button or link (`.stat-value`,
`.complaint-item`, `.brand-loc`). Those are the suite's only class-based
locators and the first thing to break if the styling is refactored.

One timing detail worth knowing: the home page renders its hero immediately but
shows an em dash on the three stat tiles until the complaints API answers,
measured at roughly 2 seconds. `HomePage.waitForData()` waits for a real number
to appear, so specs never assert against a half-loaded dashboard.

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

**CI runs the public specs only.** There is no captured session on a runner, so
the signed-in project is not registered and those tests do not run there — a
green CI run is not evidence that the signed-in home page works. Run
`npm test` locally with a session for that.

Committing `playwright/.auth/citizen.json` as a secret would fix it, and is a
bad trade: it is a live login to a real citizen account on a production-facing
deployment, and it expires. If the signed-in specs need to run unattended, the
right answer is a dedicated test account on a non-production environment.
