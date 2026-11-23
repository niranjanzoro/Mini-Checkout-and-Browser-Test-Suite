# Mini Checkout — Test Execution Results

## 1. Test Environment

Results in this report come from two environments and are labelled accordingly. **Environment A** is the original author machine (18 browser tests, before the server fix). **Environment B** is the audit sandbox (23 tests, after the server fix).

### Environment A — original author machine (pre server fix)

- **Operating System**: Microsoft Windows 11 Enterprise (Version 10.0.26300.9974)
- **Node.js Version**: `v24.21.0` (from `node -v`)
- **npm Version**: `11.19.0` (from `npm -v`)
- **Playwright Package & Dependency Versions**:
  - **Declared Range in `package.json`**: `"^1.52.0"`
  - **Installed / Resolved Version in `package-lock.json`**: `1.65.1` (verified via `npm ls @playwright/test`)
  - **Playwright CLI Version**: `1.65.1` (from `npx playwright --version`)
  - *Explanation*: The caret (`^`) in `package.json` denotes a semver compatibility range allowing non-breaking minor and patch updates (>= 1.52.0, < 2.0.0). When `npm install` resolved dependencies, it pinned version `1.65.1` into `package-lock.json`.
- **Target Browser**: Chromium `159.0.8154.6` (Playwright managed binary)
- **Local Static Server**: Node.js built-in `node:http` on `http://127.0.0.1:3000` via `app/server.js`
- **Execution Settings**: Headless, Single Worker (`workers: 1`), Retries: `0`, Locale: `en-US`, Timezone: `UTC`

### Environment B — audit sandbox (post server fix)

- **Operating System**: Linux 6.18.44 (container)
- **Node.js Version**: `v22.23.5` (from `node -v`)
- **npm Version**: `10.9.9` (from `npm -v`)
- **Playwright**: declared `^1.52.0`; resolved `1.65.1` (`npm ls @playwright/test`, `npx playwright --version`, `package-lock.json` all agree)
- **Browser**: Chromium headless shell `157.0.8103.78`, preinstalled in the sandbox. This is **not** the `159.0.8154.6` build that Playwright 1.65.1 expects: `npx playwright install chromium` failed here (download error), so the default browser could not be launched (`evidence/logs/sandbox-full-suite-attempt.txt`). The runs used a temporary config, deleted afterwards, that imported `playwright.config.ts` and added `launchOptions.executablePath` pointing at the preinstalled headless shell.
- **Execution Settings**: otherwise identical to Environment A (headless, 1 worker, 0 retries).

---

## 2. Main Automated Results (`checkout.spec.ts`: 3 tests)

*Environment A (author machine, before the server fix). Environment B re-ran all three tests after the fix: see sections 4 and 5.*

*The main suite contains exactly three tests as mandated by specification.*

| Test ID | Scenario Description | Duration (Run 3) | Status |
|:---:|:---|:---:|:---:|
| **TC-01** | Successful checkout shows a confirmation, reference (`^ORD-[A-Z0-9]{8}$`), name, `<time>` date/time, and order total | 435ms | **PASS** |
| **TC-02** | Missing name blocks checkout with `/full name/i`, sets `aria-invalid="true"`, preserves cart, allows retry | 645ms | **PASS** |
| **TC-03** | Quantity calculation updates exact totals ($9.00, $21.00, $45.00, $40.50) without float errors | 380ms | **PASS** |

- **Total Main Tests**: 3
- **Passed**: 3
- **Failed**: 0
- **Skipped**: 0
- **Main Suite Duration (Run 3)**: 1,460 ms (~1.46s)

---

## 3. Exploratory Automated Results (`exploratory.spec.ts`: 15 tests)

*Environment A (author machine, before the server fix). Environment B re-ran all 15 tests after the fix: see sections 4 and 5.*

*The exploratory automated suite covers boundaries, duplicate submissions, D-02 regression, and error resilience.*

| Test ID | Scenario Description | Duration (Run 3) | Status |
|:---:|:---|:---:|:---:|
| **TC-04** | Empty cart blocks checkout and preserves typed name | 397ms | **PASS** |
| **TC-05** | Whitespace-only name is blocked with `aria-invalid="true"` | 397ms | **PASS** |
| **TC-06** | Removing a product removes its line and updates order total | 344ms | **PASS** |
| **TC-07** | Quantity minimum clamps to 1 and minus button is disabled | 266ms | **PASS** |
| **TC-08** | Quantity maximum at 99 disables plus button and displays notice | 378ms | **PASS** |
| **TC-09a** | Rapid evaluate-clicks produce exactly one confirmation and reference | 301ms | **PASS** |
| **TC-09b** | Real mouse double-click at button coordinates produces single confirmation | 293ms | **PASS** |
| **TC-09c** | Repeated Enter on live name input produces exactly one confirmation | 360ms | **PASS** |
| **TC-09d** | Submission guard holds after success against subsequent clicks and Enter | 295ms | **PASS** |
| **TC-10** | Start new order resets cart, name, errors, and confirmation | 455ms | **PASS** |
| **TC-11** | Second order succeeds with a distinct reference code | 481ms | **PASS** |
| **TC-12** | Totals calculate accurately through additions and removals | 423ms | **PASS** |
| **TC-13** | Name maxlength enforced (60) and user input rendered safely (XSS defense) | 332ms | **PASS** |
| **TC-14** | Zero console errors or page errors across a full customer journey | 547ms | **PASS** |
| **TC-15** | D-02 Regression - quantity edit without Tab immediately registers button clicks | 402ms | **PASS** |

- **Total Exploratory Tests**: 15
- **Passed**: 15
- **Failed**: 0
- **Skipped**: 0
- **Exploratory Suite Duration (Run 3)**: 5,671 ms (~5.67s)

---

## 3b. Server Automated Results (`server.spec.ts`: 5 tests, Environment B)

*Added to cover the static-server defects S-01, S-02 and S-03. Browser-free (Playwright `request` fixture). Durations are from Environment B full run 3.*

| Test ID | Scenario Description | Duration | Status |
|:---:|:---|:---:|:---:|
| **TC-16** | `/` and `/index.html` served as `text/html` with `nosniff` | 38ms | **PASS** |
| **TC-17** | `/server.js`, `/app/server.js`, `/nope.html`, `/package.json` return 404 (S-01) | 40ms | **PASS** |
| **TC-18** | POST/PUT/DELETE/PATCH return 405 with `Allow: GET, HEAD` (S-02) | 44ms | **PASS** |
| **TC-19** | HEAD `/` returns 200 with empty body (S-02) | 9ms | **PASS** |
| **TC-20** | Malformed encoding and null bytes return 400; server stays healthy (S-03) | 18ms | **PASS** |

- **Mutation check**: run against the original `server.js`, TC-16, TC-17, TC-18 and TC-20 **FAIL** and TC-19 passes, so the tests detect the defects. (TC-16 fails there because the original sent no `nosniff` header.)
- **Why these tests were added**: static-server security was a documented in-scope risk (`TEST_PLAN.md` section 2) with no automated coverage. The suite grows from 18 to 23 tests for that reason only.
- **Not covered by Playwright**: `/../package.json` and `/%2e%2e/package.json`, because the client normalises them. They are covered by curl `--path-as-is` probes in `evidence/logs/server-probes.txt`.

---

## 4. Combined Summary

### Environment A — author machine, before server fix (18 tests)

| Category | Total | Passed | Failed | Skipped | Pass Rate |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Main Suite (`checkout.spec.ts`)** | 3 | 3 | 0 | 0 | 100.0% |
| **Exploratory Suite (`exploratory.spec.ts`)** | 15 | 15 | 0 | 0 | 100.0% |
| **Combined Total** | **18** | **18** | **0** | **0** | **100.0%** |

### Environment B — audit sandbox, after server fix (23 tests, run 3)

| Category | Total | Passed | Failed | Skipped | Flaky |
|:---|:---:|:---:|:---:|:---:|:---:|
| Main Suite (`checkout.spec.ts`) | 3 | 3 | 0 | 0 | 0 |
| Exploratory Suite (`exploratory.spec.ts`) | 15 | 15 | 0 | 0 | 0 |
| Server Suite (`server.spec.ts`) | 5 | 5 | 0 | 0 | 0 |
| **Combined Total** | **23** | **23** | **0** | **0** | **0** |

---

## 5. Three-Run Comparison Tables

### Environment A — author machine, 18 tests, before server fix

The 18-test suite was executed 3 consecutive times via `node scripts/collect-evidence.js` (`npm run test:evidence`). All values are taken verbatim from the generated Playwright JSON reports:

| Run Number | Start Time (UTC / ISO) | Duration | Expected (Passed) | Unexpected (Failed) | Skipped | Flaky | Result |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Run 1** | `2026-11-23T07:26:51.274Z` | 8,737.38 ms | 18 | 0 | 0 | 0 | **PASS** |
| **Run 2** | `2026-11-23T07:27:01.199Z` | 8,734.01 ms | 18 | 0 | 0 | 0 | **PASS** |
| **Run 3** | `2026-11-23T07:27:11.013Z` | 8,401.20 ms | 18 | 0 | 0 | 0 | **PASS** |

- **Flakiness Metric**: **0 flaky tests** across all 3 execution runs.
- **Evidence Logs**: `evidence/logs/run-1.txt`, `evidence/logs/run-2.txt`, `evidence/logs/run-3.txt` (UTF-8).
- **Evidence Reports**: `evidence/reports/results-run-1.json`, `evidence/reports/results-run-2.json`, `evidence/reports/results-run-3.json`, `evidence/reports/results-latest.json`.

---

### Environment B — audit sandbox, 23 tests, after server fix

Three consecutive full runs with the temporary Chromium config described in section 1. Logs: `evidence/logs/sandbox-run-N.txt`. Reports: `evidence/reports/sandbox-run-N.json`.

| Run Number | Start Time (UTC / ISO) | Duration | Expected (Passed) | Unexpected (Failed) | Skipped | Flaky | Result |
|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Run 1** | `2026-11-23T07:43:23.069Z` | 14,309 ms | 23 | 0 | 0 | 0 | **PASS** |
| **Run 2** | `2026-11-23T07:43:38.122Z` | 14,763 ms | 23 | 0 | 0 | 0 | **PASS** |
| **Run 3** | `2026-11-23T07:43:53.905Z` | 14,149 ms | 23 | 0 | 0 | 0 | **PASS** |

Browser-free `server.spec.ts` alone (logs `server-run-N.txt`, reports `server-run-N.json`): 5 passed, 0 failed, 0 skipped, 0 flaky in 1,048.7 ms, 998.7 ms and 1,060.9 ms.

`npm run test:evidence` was **not** used for Environment B, because it calls the default config and Chromium 159 was unavailable. The `run-N` files and `results-*.json` therefore remain the Environment A artefacts.

---

## 6. Defect History

### Defect D-01: Missing Confirmation View Markup & TypeError on Page Load
- **ID**: `D-01`
- **Severity**: Blocker
- **Environment**: Chromium / Windows 11 / Node.js v24.21.0
- **Root Cause**: On page load, `document.getElementById('new-order-btn')` returned `null`, throwing `TypeError: Cannot read properties of null (reading 'addEventListener')`. On submit, confirmation targets returned `null`, throwing unhandled exceptions and leaving the button permanently disabled.
- **Reproduction Log**: `evidence/logs/baseline-D01.txt` (7 tests failed on initial baseline).
- **Resolution**: Implemented dynamic DOM generation and mounting for `#confirmation-mount` with secure `textContent` assignment and dynamic listener binding.
- **Status**: **FIXED**

### Defect D-02: Swallowed Click After Editing Quantity
- **ID**: `D-02`
- **Severity**: Medium
- **Environment**: Chromium / Windows 11 / Node.js v24.21.0
- **Root Cause**: When the quantity input lost focus on click of `+`, `−`, or `Remove`, the input's `focusout` event triggered `render()`, which called `linesEl.replaceChildren()`. This destroyed existing DOM button elements while the mouse click was dispatched, causing the browser to swallow the click.
- **Reproduction Log**: `evidence/logs/D02-before-fix.txt`.
- **Resolution**: Replaced destructive DOM wiping with `updateLineInPlace()`, updating element attributes and text nodes in place so adjacent button elements remain attached to the DOM throughout user interactions.
- **Status**: **FIXED**

### Defect D-03: Double-Click Landing on Another Control Hypothesis
- **ID**: `D-03`
- **Severity**: N/A (Hypothesis Evaluation)
- **Environment**: Chromium / Windows 11 / Node.js v24.21.0
- **Hypothesis**: The second click of a physical double-click at "Place Order" button screen coordinates could land on a newly revealed control (such as "Start new order") and immediately dismiss the confirmation view.
- **Investigation / Outcome**: Tested via TC-09b (`page.mouse.dblclick(x, y)` at button coordinates). The confirmation card appeared, remained visible, and did not dismiss or trigger subsequent actions.
- **Status**: **not reproduced**

### Defect S-01: Server source file publicly served
- **ID**: `S-01`
- **Severity**: Low to Medium (information exposure)
- **Environment**: Environment B (found during the final audit)
- **Reproduction**: `GET /server.js` returned `200 application/javascript` because `.js` was allow-listed and the web root was `app/`. Output: `evidence/logs/server-probes.txt` (BEFORE section).
- **Resolution**: `server.js` serves only an explicit allow-list (`index.html`). `GET /server.js` now returns 404.
- **Verification**: TC-17, probes. **Status**: **FIXED**

### Defect S-02: No HTTP method check
- **ID**: `S-02`
- **Severity**: Low
- **Reproduction**: `POST /` returned `200 text/html`.
- **Resolution**: only GET and HEAD are accepted; others return 405 with `Allow: GET, HEAD`; HEAD returns no body.
- **Verification**: TC-18, TC-19, probes. **Status**: **FIXED**

### Defect S-03: No URL decoding, null-byte handling or error handling
- **ID**: `S-03`
- **Severity**: Low (traversal was not exploitable; hardening)
- **Reproduction**: `GET /%E0%A4%A` and `GET /%00` returned 404 instead of 400, `%2e%2e` was never decoded, and the handler had no try/catch. No crash was reproduced, so this is recorded as a hardening gap, not a confirmed exploit.
- **Resolution**: decode in try/catch (400), reject null bytes (400), containment check after decoding (403), wrapped handler (500), `nosniff` header.
- **Verification**: TC-20, probes (`/%2e%2e/package.json` now returns 403). **Status**: **FIXED**

---

## 7. Fixed-Defect Verification

| Defect ID | Verification Tests | Observed Post-Fix Behavior | Status |
|:---:|:---|:---|:---:|
| **D-01** | TC-01, TC-02, TC-09a–d, TC-10, TC-11, TC-14 | Zero page errors on load. Confirmation renders complete details (`order-reference`, `confirmation-name`, `<time>`, `confirmation-total`). "Start new order" listener attaches and resets application cleanly. | **FIXED** |
| **D-02** | TC-15 | Entering a quantity without pressing Tab and immediately clicking `+` increments quantity to 6 ($27.00). Immediately clicking `Remove` deletes the item line. Zero swallowed clicks. | **FIXED** |
| **S-01** | TC-17, curl probes | `/server.js` returns 404 (was 200). | **FIXED** |
| **S-02** | TC-18, TC-19, curl probes | POST returns 405 with `Allow: GET, HEAD` (was 200); HEAD has no body. | **FIXED** |
| **S-03** | TC-20, curl probes | Malformed encoding and `%00` return 400; `%2e%2e` traversal returns 403. | **FIXED** |

---

## 8. Manual Testing Status

*Automated Playwright tests are not manual tests and are not relabelled as manual testing. Because no interactive graphical desktop environment with a human operator was used during this audit, manual test executions are marked PENDING with step-by-step instructions for human verification.*

### MT-01: Empty Cart Submission
- **Test ID**: `MT-01`
- **Scenario**: Verify empty cart validation and state preservation in an interactive browser.
- **Step-by-Step Instructions**:
  1. Start application with `npm start` and open `http://127.0.0.1:3000` in a browser.
  2. Verify cart displays empty message and total is `$0.00`.
  3. In the "Full Name" input, enter `"Alice Walker"`.
  4. Click the "Place Order" button.
- **Expected Result**:
  - `cart-error` banner appears with text: *"Your cart is empty — please add at least one item before placing an order."*
  - Name input retains `"Alice Walker"`.
  - Order total remains `$0.00`.
  - No order confirmation is shown.
- **Actual Result**: *(Pending execution by a human tester in an interactive browser)*
- **Status**: **PENDING**

### MT-02: Rapid Double-Click Submission
- **Test ID**: `MT-02`
- **Scenario**: Verify single confirmation and stable UI upon rapid physical double-click.
- **Step-by-Step Instructions**:
  1. Start application with `npm start` and open `http://127.0.0.1:3000` in a browser.
  2. Click "Add to Cart" on the Notebook item ($4.50).
  3. In the "Full Name" input, enter `"Charlie Brown"`.
  4. Rapidly double-click the "Place Order" button as fast as possible.
- **Expected Result**:
  - Exactly one order confirmation screen appears.
  - Exactly one reference code starting with `ORD-` is displayed.
  - The confirmation card remains visible and stable (does not dismiss or trigger subsequent actions).
- **Actual Result**: *(Pending execution by a human tester in an interactive browser)*
- **Status**: **PENDING**

---

## 9. Known Limitations

1. **Mixed environments**: the 18 browser tests were last run on the author machine (Environment A, Chromium 159.0.8154.6) **before** the server fix. After the fix they were re-run only in Environment B, on Chromium 157.0.8103.78 (23/23 PASS, three runs). They have **not** been re-run on Chromium 159 with the fixed server. To close this, run `npm run test:evidence` on a machine where `npx playwright install chromium` works. The screenshots in `evidence/screenshots/` are from Environment A.

2. **Interactive Headed Human Session**: Because no physical interactive desktop environment was accessible to a human operator, MT-01 and MT-02 remain marked PENDING for human tester execution.
3. **Single Browser Scope**: Automated tests were run exclusively against Chromium per the specification constraint. Other rendering engines (WebKit, Gecko) were not evaluated.
4. **Session-Scoped Reference Uniqueness**: Reference uniqueness checking uses an in-memory `Set` scoped to the current browser page session. Cross-tab and persistent synchronization is out of scope by design for this client-only single-page application.
