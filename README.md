# Ballot lab

A static, interactive commit–reveal voting simulator. Three mock voters choose between a community garden, a public library and bike lanes. The clock moves only when you advance it; no wallet, signatures, transactions, backend, analytics or remote runtime assets are used.

**This demo is not an audited on-chain voting product.** Inputs and event details deliberately expose mock choices and salts. It provides no real identity, privacy, consensus or adversarial security guarantees. Use no real secrets.

## Install, preview and rebuild

Requires Node.js 22.12+ (validated with Node 24.9.0 and npm 11.6.0).

```sh
npm ci
npm run dev
```

Preview the included production export without rebuilding:

```sh
npm run preview -- --host 127.0.0.1
```

Open the address printed by Vite. To rebuild and check:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The checked-in `dist/` is the finished website. JavaScript is required; serve it over HTTP(S), rather than opening it with `file://`. The build uses Vite, React and TypeScript. SHA-256 comes from `@noble/hashes`; the local Inter font includes its license.

## Try the simulation

1. At ticks **0–9**, choose Alice, Bob or Charlie, select an option and enter a mock salt. Select **Commit vote**. Repeat for the other voters.
2. Select **Advance to reveal** to reach tick **10**. For each committed voter, reveal the exact same option and salt. **Restore committed values** recovers the demo inputs if you edit them.
3. Open **Test the rejection rules**. Try a wrong salt before revealing, then a duplicate after a successful reveal. Both attempts are logged and leave the tally unchanged. Submitting in the wrong phase also logs a rejection.
4. Advance to tick **20**, then **Finalize vote**. Only valid reveals count. Ties remain ties; an empty tally has no winner.
5. Select an event or **Replay from start** to reconstruct the state at that point. Step backward/forward; **Return to live** preserves the original experiment. Replay does not advance time automatically.

Four deterministic samples cover a complete vote, rejection failures, a missed reveal and a three-way tie. Loading a sample replaces the current run. **Undo** restores the previous run until another action; reset has the same recovery option.

**Refresh behavior:** all state, mock drafts and events live in page memory. Refresh starts a new simulation at tick 0; no browser storage is written. Replay lasts for this session. The form retains the session’s draft inputs during replay, while the voting state is reconstructed from the event prefix.

## Commitment and rules

The commitment is the lowercase hexadecimal SHA-256 digest of the UTF-8 JSON array:

```text
["ballot-lab:v1", "community-fund-001", voter, optionIndex, exactSalt]
```

Option indices are 0 (garden), 1 (library), 2 (bike lanes). Voter strings are exactly `Alice`, `Bob`, `Charlie`. JSON encoding prevents concatenation ambiguity. Salts must contain a non-whitespace character and be at most 64 JavaScript string code units; whitespace and case are otherwise preserved. Inspect the full preimage and hashes in the interface.

Each voter may commit once and reveal once. The core state stores the commitment and revealed option, not the salt; the educational action history and form drafts do contain mock plaintext. The clock only accepts forward integer ticks up to 99. Finalization is explicit at tick 20 or later and seals the state. Rejected events remain replayable but cannot alter voting state.

This omits production requirements such as unpredictable private salts, authenticated voters, chain-specific hashing, anti-front-running and censorship protections, consensus, economic incentives and security audits.

## Browser validation

```sh
npx playwright install chromium
npm run test:browser
```

The browser script serves `dist/` at an ephemeral local `/preview/` subpath, runs Chromium interactions and axe checks, and writes screenshots/results to `artifacts/`. It closes its server and browser before exiting. `EVIDENCE_DIR` optionally changes the evidence directory; `PLAYWRIGHT_BROWSERS_PATH` can point to a temporary browser installation.

Actual worker results on 2026-09-27: production build and typecheck passed; **21/21 engine tests** and **11/11 browser validation groups** passed. Desktop 1440×1000 and mobile 390×844 were inspected; additional 320px/820px reflow and 200% root-text checks passed without horizontal page overflow. Three axe scans reported no violations, with one decorative arrow contrast item requiring manual interpretation. No console errors, failed resources or remote requests occurred.

Dependencies and Chromium were installed under `/tmp/` during this assignment; matching source/configuration was copied there for the commands above, and the final export copied back. The supplied browser connector could not launch its missing Chrome binary; the included Playwright script provided the actual rendered validation. Native browser zoom, physical devices, screen readers, Firefox/Safari and localization were not tested. Text enlargement is not native browser zoom. See [the brief test report](artifacts/test-report.md) and [the six-domain review](artifacts/validation.md).

## Publish

Upload **the entire contents of `dist/`** to a static HTTP(S) host, including `assets/`, `fonts/`, `favicon.svg` and license notices. No server rewrite or environment variables are required. Vite’s `base: './'` emits relative asset URLs; in-page hash links work at a hosting subpath. The export was tested under `/preview/`. Refresh does not require route fallback rules because there is only one HTML page.

The publisher serves the included export and does not rebuild it. After any source or public-asset change, run the build again and include the refreshed `dist/` in the submission. Do not publish source, tests or dependency directories as the website. Keep source, `package.json`, `package-lock.json`, documentation and `dist/` in the repository; do not include `node_modules`, caches, dependency archives or submodules.

The explicit `.gitignore` path budget is **256 bytes**, recorded in `artifacts/path-budget.json`; the file is 171 bytes and does not exclude `dist/`. The submission limit is 8,388,608 bytes. Final file/byte accounting is in `artifacts/bundle-report.json`.

## Source map

| Path | Purpose |
| --- | --- |
| `src/simulation.ts` | Pure state transitions, SHA-256 commitments, replay and fixed scenarios |
| `src/App.tsx` | Clock, vote form, tally, reset/undo, replay log and explanations |
| `src/styles.css` | Tokens, native-control states and responsive layouts |
| `src/Icon.tsx` | Local decorative SVG icons |
| `tests/simulation.test.ts` | Rule, boundary, replay and hash validation |
| `tests/browser.mjs` | Production-export browser and accessibility checks |
| `DESIGN.md` | Implemented design system and responsive behavior |
| `artifacts/` | Test report, consolidated review and actual browser evidence |

Design guidance: Jakub Krehel’s Better Interface, MIT, pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`. Documentation method: Paul Bakaus’s Impeccable, Apache-2.0, pinned commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. These were references, not application code; no guide text is republished. Dependency and font license notices accompany the export.
