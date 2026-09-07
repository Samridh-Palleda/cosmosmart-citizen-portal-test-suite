//! CI RESULTS PAGE — turns Playwright output into a plain-English report.
//! Writes a pass/fail table into the GitHub Actions job summary so a
//! non-technical reader can see what broke without downloading anything.
//! Maps every test to a feature name and a sentence about what a failure
//! means. Does nothing outside GitHub Actions, so local runs are unaffected.

import { appendFileSync } from "node:fs";
import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

/**
 * Writes a results table into the GitHub Actions **job summary** - the page
 * you land on after a run - so nobody has to download and unzip an artifact
 * to answer "did it pass, and what broke?".
 *
 * Written for a NON-TECHNICAL reader. A raw Playwright failure says things
 * like `expect(received).toBeVisible()`, which tells a manager nothing. Every
 * test is mapped to the feature it covers and a plain sentence describing what
 * a failure means, with the technical detail tucked into a collapsible block
 * underneath.
 *
 * Deliberately hand-written rather than pulling in a third-party reporter:
 * no dependency to vet, and nothing that can break on someone else's release.
 * Outside GitHub Actions `GITHUB_STEP_SUMMARY` is undefined and this does
 * nothing at all, so local runs are unaffected.
 */

interface Row {
  title: string;
  suite: string;
  project: string;
  status: TestResult["status"];
  expectedStatus: TestCase["expectedStatus"];
  outcome: ReturnType<TestCase["outcome"]>;
  durationMs: number;
  error?: string;
  retries: number;
}

/**
 * Plain-English meaning of each test, keyed by a distinctive phrase in its
 * title. First match wins, so more specific entries come first.
 *
 * The feature name may be a function, which receives the regex match - used
 * where one entry covers a family of generated tests and the name should say
 * which one.
 */
type FeatureName = string | ((match: RegExpMatchArray) => string);

const MEANINGS: Array<[RegExp, FeatureName, string]> = [
  // [match, feature name, what a failure means]

  // --- The sign-in screen ----------------------------------------------------
  [
    /renders the sign-in form/,
    "Sign-in page loads",
    "The sign-in page did not draw properly - the tabs, the city dropdown or the Send code button was missing. No citizen can sign in or register at all.",
  ],
  [
    /sends citizens to \/auth/,
    "Front page opens the sign-in screen",
    "Typing the portal's address no longer lands on the sign-in screen. Anyone arriving at the site would see a blank page instead of a way in.",
  ],
  [
    /offers SMS and email/,
    "Both ways to get a code are offered",
    "The choice between an SMS code and an email code is missing, or the page no longer starts on SMS. Citizens without email would be shut out.",
  ],
  [
    /switching to email swaps/,
    "Choosing email asks for an email",
    "Picking \"Email OTP\" did not replace the mobile number box with an email box, so there is no way to type an address.",
  ],
  [
    /switching back to SMS/,
    "Choosing SMS asks for a mobile number",
    "Switching back from email to SMS did not bring the mobile number box back, leaving the citizen stuck on email.",
  ],
  [
    /lists the cities the portal serves/,
    "City list loads",
    "The \"Your city\" dropdown is empty, so a citizen cannot pick their municipal corporation. Reports would go to the wrong council or nowhere at all.",
  ],
  [
    /Create Account asks for a name/,
    "Registration asks for a name",
    "The Create Account tab did not show the Full name box, so nobody can register a new account.",
  ],
  [
    /remembers the chosen channel/,
    "Choice of SMS or email is kept",
    "Switching between Sign In and Create Account forgot whether the citizen wanted a code by SMS or by email, so they have to choose again.",
  ],

  // --- Guards before a code is sent -----------------------------------------
  [
    /will not send a code to an empty mobile box/,
    "Empty mobile box blocks Send code",
    "Send code should stay switched off while the mobile number box is empty. It is clickable, so a code can be requested for nobody.",
  ],
  [
    /will not send a code to an empty email box/,
    "Empty email box blocks Send code",
    "Send code should stay switched off while the email box is empty. It is clickable, so a code can be requested for nobody.",
  ],
  [
    /enables Send code once a full mobile number/,
    "Send code switches on for a mobile number",
    "With a full mobile number typed the Send code button is still switched off, so nobody can sign in by SMS at all.",
  ],
  [
    /enables Send code once an email address/,
    "Send code switches on for an email",
    "With an email address typed the Send code button is still switched off, so nobody can sign in by email at all.",
  ],
  [
    /an empty form never reaches the server/,
    "Empty form never reaches the server",
    "The page should catch an empty form itself. Instead it asked the server to send a code to nobody, which wastes an SMS and gives the wrong message when the connection is down.",
  ],
  [
    /does not send a code when no city could be loaded/,
    "Known issue: a code is sent for a city nobody chose",
    "When the city list fails to load the dropdown is empty, but Send code still works and quietly files the citizen under Faridabad - the city built into the app. Someone in Pune would have their report sent to the wrong municipal corporation, with no way to see it happened. This is a recorded known issue, not a new problem.",
  ],

  // --- The home page: is every box drawn, with real content in it? -----------
  [
    /draws both panels side by side/,
    "Home page layout holds together",
    "One of the two halves of the home page is missing - either the green panel explaining the service, or the white card holding the sign-in form. The page would look broken to anyone arriving.",
  ],
  [
    /shows the brand block/,
    "Portal name and logo",
    "The CosmoSmart name, logo or \"Citizen Portal\" tagline is missing from the top of the page, so a visitor cannot tell whose service this is.",
  ],
  [
    /shows the headline and the explanation/,
    "Headline explains the service",
    "The headline telling citizens this is where to report waterlogging, or the sentence under it, did not appear. A first-time visitor has no idea what the site does.",
  ],
  [
    /builds all four feature cards/,
    "All four feature cards are built",
    "The panel should list four things the portal does. A different number appeared, so a card is missing or has been drawn twice.",
  ],
  [
    /fills every feature card with its own text/,
    "Each feature card has its own text",
    "The four cards were drawn, but one of them is empty or is showing the wrong promise. The boxes look right and the words in them do not.",
  ],
  [
    /builds both delivery tiles/,
    "Both ways to get a code are shown",
    "The two tiles offering an SMS code or an email code did not both appear with their label and description, or neither was ticked. Citizens could not choose how to receive their code.",
  ],
  [
    /labels both input boxes/,
    "Input boxes are labelled",
    "A box on the form was drawn with no label above it, so nobody - and no screen reader - can tell what to type in it.",
  ],
  [
    /fills the city dropdown from the corporations API/,
    "City dropdown has real cities in it",
    "The \"Your city\" dropdown was drawn but came back empty, or one of the cities has no name. A citizen cannot choose their municipal corporation.",
  ],
  [
    /shows the footer/,
    "Footer is shown",
    "The footer naming Cosmos Pumps and the municipal partnership is missing from the bottom of the panel.",
  ],
  [
    /renders no unresolved values/,
    "No missing data shown on screen",
    "Something the page expected to fill in was not there, so it printed the gap instead - words like \"undefined\" or \"NaN\" are visible to citizens. The page still looks laid out correctly, which is why this is easy to miss by eye.",
  ],
  [
    /leaves no card empty/,
    "No card is drawn empty",
    "A card rendered with its border and spacing but nothing inside it. The layout still looks plausible, so this would pass a quick glance.",
  ],

  // --- The public page -------------------------------------------------------
  [
    /boots the app rather than serving an empty shell/,
    "The app actually starts",
    "The server answered, but nothing was drawn on the page. The site is built so that the server always replies successfully even when the app itself is broken, so this is the check that tells them apart.",
  ],
  [
    /reaches the form without a console error/,
    "No errors while loading",
    "Something failed quietly while the page loaded. The screen can look perfectly fine and still be broken underneath, so this watches for errors the citizen never sees.",
  ],
  [
    /fits a phone screen/,
    "Works on a phone",
    "Part of the sign-in screen runs off the side of a phone display, so something cannot be reached without scrolling sideways. Most citizens reporting a flooded street are on a phone, outdoors.",
  ],
];

function meaning(title: string): { feature: string; explanation: string } {
  for (const [pattern, feature, explanation] of MEANINGS) {
    const match = title.match(pattern);
    if (match) {
      return {
        feature: typeof feature === "function" ? feature(match) : feature,
        explanation,
      };
    }
  }
  return { feature: title, explanation: "" };
}

/** Which part of the app the test was driving, in plain words. */
const AREA: Record<string, string> = {
  "signed-out": "Citizen portal",
};

/**
 * Playwright colours its error messages for the terminal. Those escape
 * sequences render as literal junk ("[31m...[39m") in markdown, so they are
 * stripped here along with the whitespace that breaks a table.
 *
 * The \u001b is the ESC character that begins the sequence and MUST be part
 * of the pattern. Matching only "[31m" leaves the ESC glued to the front of
 * the line - invisible once rendered, but enough to defeat the "is this
 * machine noise?" check in plainFacts(), which anchors on ^.
 */
const ANSI = /\u001b\[[0-9;]*m/g;

function clean(text: string, max = 300): string {
  const flat = text.replace(ANSI, "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Turns Playwright's comparison into words rather than symbols.
 * A regular expression like /waterlogging/i reads as
 * `text containing "waterlogging"`.
 */
function readableExpectation(raw: string): string {
  const value = raw.trim().replace(/^"(.*)"$/s, "$1");

  const comparison = value.match(/^(>=|<=|>|<)\s*(.+)$/);
  if (comparison) {
    const word = {
      ">=": "at least",
      "<=": "no more than",
      ">": "more than",
      "<": "less than",
    }[comparison[1]]!;
    return `${word} ${comparison[2]}`;
  }

  const pattern = value.match(/^\/(.+)\/[a-z]*$/);
  if (pattern) {
    const plain = pattern[1].replace(/\\b/g, "").replace(/\\/g, "");
    return `text containing "${plain}"`;
  }

  return value;
}

/**
 * Pulls the useful facts out of a Playwright failure: what we were checking,
 * what we wanted, and what was actually there.
 *
 * Without this the summary can only say "the sign-in page did not load", which
 * is true but useless - it does not say what was looked for or what was on
 * screen instead. These lines are the difference.
 */
function plainFacts(rawError: string): Array<[string, string]> {
  const text = rawError.replace(ANSI, "");
  const facts: Array<[string, string]> = [];

  const label = text.match(/^Error:\s*(.+)$/m)?.[1]?.trim();
  const isMachineNoise =
    !label ||
    label.length > 140 ||
    /^(expect|locator|page\.|net::|ENOENT|Timed out|Test timeout)/i.test(label);
  if (!isMachineNoise) facts.push(["What was being checked", label]);

  const locator = text.match(/^Locator:\s*(.+)$/m)?.[1];
  if (locator) facts.push(["What was looked for", clean(locator, 200)]);

  const expected = text.match(
    /^Expected(?: pattern| string| substring| value)?:\s*(.+)$/m,
  )?.[1];
  if (expected) facts.push(["Expected", readableExpectation(expected)]);

  const receivedBlock = text.match(
    /^Received(?: pattern| string| value)?:\s*([\s\S]*)$/m,
  )?.[1];
  if (receivedBlock) {
    const received = receivedBlock.split(/\n(?:Call log:|Timeout:|\s+-\s)/)[0];
    facts.push(["Found instead", clean(received, 400)]);
  }

  /*
   * Nothing matched, so this is not a comparison at all - a page that never
   * loaded, a missing file, a dropped connection. The first line of the
   * error is the most useful thing available.
   */
  if (facts.length === 0) {
    const firstLine = text.split("\n").find((line) => line.trim());
    facts.push(["What went wrong", clean(firstLine ?? "no details", 300)]);
  }

  return facts;
}

/** Renders the facts above as a small two-column table. */
function factsTable(facts: Array<[string, string]>): string[] {
  return [
    "| | |",
    "| --- | --- |",
    ...facts.map(
      ([name, value]) => `| **${name}** | ${value.replace(/\|/g, "\\|")} |`,
    ),
    "",
  ];
}

function humanDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function projectName(test: TestCase): string {
  let suite: Suite | undefined = test.parent;
  while (suite) {
    const name = suite.project()?.name;
    if (name) return name;
    suite = suite.parent;
  }
  return "";
}

class GitHubSummaryReporter implements Reporter {
  private readonly rows: Row[] = [];
  private readonly cases = new Map<string, TestCase>();
  private startedAt = 0;

  onBegin(): void {
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const key = `${projectName(test)}::${test.parent?.title ?? ""}::${test.title}`;
    this.cases.set(key, test);
    this.rows.push({
      title: test.title,
      suite: test.parent?.title ?? "",
      project: projectName(test),
      status: result.status,
      expectedStatus: test.expectedStatus,
      // Provisional - recomputed in onEnd once every retry is in.
      outcome: "expected",
      durationMs: result.duration,
      error: result.error?.message,
      retries: result.retry,
    });
  }

  onEnd(result: FullResult): void {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryFile) return; // not running in GitHub Actions

    // Only the final attempt of each test counts towards the totals.
    const finalAttempts = new Map<string, Row>();
    for (const row of this.rows) {
      const key = `${row.project}::${row.suite}::${row.title}`;
      const seen = finalAttempts.get(key);
      if (!seen || row.retries >= seen.retries) finalAttempts.set(key, row);
    }

    // outcome() is only meaningful once all retries are done.
    const final = [...finalAttempts.entries()].map(([key, row]) => ({
      ...row,
      outcome: this.cases.get(key)?.outcome() ?? "expected",
    }));

    /*
     * A test marked `test.fail()` records a bug we already know about: it is
     * SUPPOSED to fail, so Playwright calls that outcome "expected" and the
     * run stays green. Treating it as a failure here would cry wolf on every
     * single run; hiding it entirely would let the bug be forgotten. It gets
     * its own section instead.
     *
     * The interesting case is the opposite one - a `test.fail()` that PASSES.
     * That means somebody fixed the bug, and it is reported loudly because
     * the marker now needs removing.
     */
    const knownIssues = final.filter(
      (r) => r.expectedStatus === "failed" && r.outcome === "expected",
    );
    const fixed = final.filter(
      (r) => r.expectedStatus === "failed" && r.status === "passed",
    );
    const failed = final.filter(
      (r) => r.outcome === "unexpected" && r.expectedStatus !== "failed",
    );
    const skipped = final.filter((r) => r.outcome === "skipped");
    const flaky = final.filter((r) => r.outcome === "flaky");
    const passed = final.filter(
      (r) =>
        r.status === "passed" &&
        r.expectedStatus !== "failed" &&
        r.outcome !== "skipped",
    );

    const place = (row: Row): string => AREA[row.project] ?? row.project;
    const ran = final.length - skipped.length;

    const lines: string[] = [
      "## 🌊 CosmoSmart Citizen test results",
      "",
      "A robot used the citizen portal the way a member of the public would. It opened the site, chose between an SMS code and an email code, picked a city, and tried to request a code with the form empty, half filled and properly filled. It stops short of actually sending one, because a real code costs a real text message. This is what happened.",
      "",
    ];

    if (failed.length === 0 && fixed.length === 0) {
      lines.push(
        `✅ **Everything passed** — ${passed.length} checks in ${humanDuration(
          Date.now() - this.startedAt,
        )}.`,
        "",
        "Nothing is broken. Everything in the list below was checked.",
        "",
      );
    } else {
      const broken = failed.length + fixed.length;
      lines.push(
        `❌ **${broken} of ${ran} checks need attention** — ` +
          `in ${humanDuration(Date.now() - this.startedAt)}.`,
        "",
        `The other ${ran - broken} were fine. Each problem is written out below: what it means for a citizen, then exactly what was expected and what was actually found.`,
        "",
        "### What went wrong",
        "",
      );

      for (const row of failed) {
        const { feature, explanation } = meaning(row.title);

        lines.push(
          `#### ❌ ${feature}`,
          "",
          `**Where:** ${place(row)}`,
          "",
          explanation ? `${explanation}` : "",
          "",
          ...factsTable(plainFacts(row.error ?? "no error message")),
          "<details><summary>Full technical detail for the developer</summary>",
          "",
          "```",
          clean(row.error ?? "no error message", 1200),
          "```",
          "",
          `Test: \`${row.title}\``,
          "",
          "</details>",
          "",
        );
      }

      for (const row of fixed) {
        lines.push(
          `#### 🎉 Looks fixed: ${meaning(row.title).feature}`,
          "",
          `**Where:** ${place(row)}`,
          "",
          "This was recorded as a known issue, and it has just passed — so it appears to have been fixed. Good news, but the run is marked failed on purpose so nobody misses it.",
          "",
          `**Action:** remove the \`test.fail()\` marker from \`${row.title}\` so this becomes a normal check.`,
          "",
        );
      }
    }

    if (knownIssues.length) {
      lines.push(
        "### ⚠️ Known issues and features not built yet",
        "",
        "Two different things share this list, and each line says which it is:",
        "a **known issue** is a bug we have already recorded, and a **not built",
        "yet** item is MVP work that simply has not been written. Neither turns",
        "the run red. Both go red the moment they start working, which is the",
        "signal to promote them to normal checks.",
        "",
        ...knownIssues.map((r) => {
          const { feature, explanation } = meaning(r.title);
          return `- **${feature}** — ${explanation}`;
        }),
        "",
      );
    }

    if (flaky.length) {
      lines.push(
        "### ⚠️ Passed only after a retry",
        "",
        "These failed once and then worked. That normally means the internet",
        "connection or the server was slow for a moment, not that the feature",
        "is broken - so the run is not treated as a failure. Worth a look if",
        "the same one keeps appearing.",
        "",
        ...flaky.map((r) => `- ${meaning(r.title).feature} _(${place(r)})_`),
        "",
      );
    }

    // Screenshots and traces cannot be shown inline - GitHub strips images
    // that are not fetchable URLs - so point at where they actually are.
    const runUrl =
      process.env.GITHUB_SERVER_URL &&
      process.env.GITHUB_REPOSITORY &&
      process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}#artifacts`
        : "";

    if (failed.length && runUrl) {
      lines.push(
        "### 📎 Screenshots and replays",
        "",
        `Every failure above was recorded. Download **test-results** from the [Artifacts section of this run](${runUrl}) for screenshots and a step-by-step replay.`,
        "",
      );
    }

    if (skipped.length) {
      lines.push(
        `<details><summary>${skipped.length} checks were skipped</summary>`,
        "",
        "A skipped check did not run at all.",
        "",
        ...skipped.map((r) => `- ${meaning(r.title).feature} _(${place(r)})_`),
        "",
        "</details>",
        "",
      );
    }

    /*
     * Shown open, not folded away. It is the one place that answers "was my
     * bit checked at all?", and a reader should not have to know there is a
     * dropdown to find it.
     */
    lines.push(
      "### Full list of checks",
      "",
      "| | Check | Where | Time |",
      "| --- | --- | --- | --- |",
      ...final.map((r) => {
        const icon =
          r.outcome === "skipped"
            ? "⏭️"
            : r.expectedStatus === "failed" && r.status === "passed"
              ? "🎉"
              : r.expectedStatus === "failed"
                ? "⚠️"
                : r.outcome === "unexpected"
                  ? "❌"
                  : r.outcome === "flaky"
                    ? "⚠️"
                    : "✅";
        return `| ${icon} | ${meaning(r.title).feature} | ${place(r)} | ${humanDuration(r.durationMs)} |`;
      }),
      "",
    );

    void result;

    try {
      appendFileSync(summaryFile, lines.join("\n"), "utf8");
    } catch (error) {
      // A broken summary must never fail an otherwise good run.
      console.warn(`Could not write GitHub job summary: ${String(error)}`);
    }
  }
}

export default GitHubSummaryReporter;
