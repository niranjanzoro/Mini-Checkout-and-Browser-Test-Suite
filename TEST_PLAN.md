# Mini Checkout — Test Plan

## 1. Objectives
This test plan defines the testing strategy, risk analysis, test specifications, and verification criteria for the **Mini Checkout** single-page web application. The objective is to verify that the checkout flow executes deterministically, accurately calculates monetary totals in integer cents without floating-point errors, enforces validation and boundary rules, guards against duplicate submissions, eliminates swallowed clicks on quantity edits, and maintains a clean, accessible user interface.

---

## 2. Scope & Boundaries

### In Scope
- Core product catalogue presentation (Notebook $4.50, Pen Set $12.00).
- Cart state management: adding items, quantity increment/decrement, line removal, and empty state.
- Strict monetary calculations in integer cents ($0.00 formatted display).
- Input validation: quantity clamping `[1, 99]`, name trimming, maximum length enforcement, whitespace handling.
- Swallowed click prevention: in-place DOM updates during quantity editing (D-02 fix).
- Error announcement and accessibility: `role="alert"`, `role="status"`, and `aria-invalid`.
- Checkout submission guard: preventing double orders under rapid clicks, Enter presses, or post-submission interactions.
- Order confirmation view: snapshot rendering of reference code, customer name, readable date/time inside `<time datetime="ISO">`, itemised list, and "Order total".
- State reset via "Start new order".
- Security and protocol behaviour of the local static file server (path traversal prevention, source-file exposure, HTTP method handling, malformed URLs).

### Out of Scope
- Backend database storage, user authentication, or persistent sessions.
- Payment gateway integrations (Stripe, PayPal, etc.).
- Cross-browser matrix testing (testing focused on Chromium per specification).
- Multi-currency conversion or internationalised tax/shipping computation.
- Network latency simulation and distributed load testing.

---

## 3. Environment Specifications

| Component | Specification | Details / Notes |
|:---|:---|:---|
| **Operating System** | Microsoft Windows 11 Enterprise (Version 10.0.26300.9974) | Host execution environment |
| **Runtime Environment** | Node.js v24.21.0 | Command: `node -v` |
| **Package Manager** | npm 11.19.0 | Command: `npm -v` |
| **Test Automation Framework** | `@playwright/test` | Declared: `"^1.52.0"` in `package.json`<br>Installed / Resolved: `1.65.1` in `package-lock.json`<br>Playwright CLI: `1.65.1`<br>*Note*: Caret (`^`) denotes semver compatibility range allowing minor/patch updates. |
| **Target Browser** | Chromium 159.0.8154.6 | Playwright managed headless browser |
| **Local Server** | `app/server.js` | Built on Node built-in `http`, running on `http://127.0.0.1:3000` |
| **Execution Parameters** | Timezone: `UTC`, Locale: `en-US`, Workers: `1`, Retries: `0` | Deterministic single-worker execution |

---

## 4. Risk Analysis

Risks are prioritised based on business impact and likelihood:

| Rank | Risk Category | Failure Mode / Description | Impact | Likelihood | Mitigation Strategy |
|:---:|:---|:---|:---:|:---:|:---|
| **1** | **Incorrect Totals** | Floating-point precision errors (e.g. `$4.50 * 3 = $13.49999...`) cause incorrect charges. | Critical | High | All calculations performed in integer cents; formatted to string only for display. Tested in TC-01, TC-03, TC-06, TC-12. |
| **2** | **Duplicate Orders** | Rapid clicking or keyboard presses on "Place Order" trigger duplicate submissions. | Critical | High | Synchronous state guard (`isSubmitting`/`orderPlaced`) locked prior to DOM mutation; button disabled. Tested in TC-09a, TC-09b, TC-09c, TC-09d. |
| **3** | **Invalid Checkout Submissions** | Submitting with empty cart or blank name succeeds or permanently locks the submission guard. | High | High | Cart validated first, then name; guard set only on success; failed validation preserves form state and allows retry. Tested in TC-02, TC-04, TC-05. |
| **4** | **Incorrect Quantity Handling** | Decimal (`"2.7"`), negative, zero, or `>99` quantities cause negative totals, `NaN`, or swallowed button clicks. | High | Medium | Clamping via `Number.isInteger()`, range checks `[1, 99]`, and in-place DOM updates. Tested in TC-07, TC-08, TC-15. |
| **5** | **Cart-State Corruption** | Removing an item or changing quantities leaves stale line totals or desynchronised order totals. | High | Medium | State recomputed from single cart Map on every user interaction. Tested in TC-03, TC-06, TC-12. |
| **6** | **Confirmation Accuracy** | Confirmation displays mutable/unescaped data, raw unreadable dates, or reference collisions. | Medium | Low | Snapshot taken at submit; DOM rendered with `textContent`; references checked against session Set. Tested in TC-01, TC-11, TC-13. |

---

## 5. Automated Test Specifications & Results

### 5.1 Main Suite (`checkout.spec.ts` — Exactly 3 Checks)

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---:|
| **TC-01** | Successful checkout with confirmation | 1. Add Notebook ($4.50).<br>2. Fill name "Jane Doe".<br>3. Place order. | Confirmation visible; "Order confirmed" shown; name "Jane Doe"; reference matches `^ORD-[A-Z0-9]{8}$`; date displayed as "Nov 23, 2026, 12:00 PM UTC" inside `<time datetime="2026-11-23T12:00:00.000Z">`; total `$4.50`. | Confirmation visible; reference matches regex; `<time>` displays exact literal date string with valid ISO datetime attribute; total `$4.50`. | **PASS** |
| **TC-02** | Missing name blocks order and preserves cart | 1. Add Notebook ($4.50).<br>2. Leave name blank.<br>3. Place order.<br>4. Enter name and retry. | `name-error` visible matching `/full name/i`; `aria-invalid="true"`; cart line and total `$4.50` preserved; confirmation count 0.<br>On retry: order confirmed. | Error displayed; cart preserved; confirmation count 0; re-submit succeeded. | **PASS** |
| **TC-03** | Quantity calculation updates exact totals | 1. Add Notebook, set qty 2 ($9.00).<br>2. Add Pen Set ($12.00) -> total $21.00.<br>3. Change Pen Set to 3 ($36.00) -> total $45.00.<br>4. Change Notebook to 1 -> total $40.50. | Every line total and order total matches exact dollar amounts at every step without rounding discrepancies. | Exact totals calculated ($9.00, $21.00, $45.00, $40.50) without float errors. | **PASS** |

### 5.2 Exploratory Suite (`exploratory.spec.ts` — TC-04 through TC-15)

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status |
|:---:|:---|:---|:---|:---|:---:|
| **TC-04** | Empty cart submission | 1. Type name "Alice Walker".<br>2. Leave cart empty.<br>3. Place order. | `cart-error` contains "cart is empty"; name preserved; confirmation count 0. | Error displayed; name "Alice Walker" preserved; confirmation count 0. | **PASS** |
| **TC-05** | Whitespace-only name validation | 1. Add Notebook.<br>2. Fill name with `"     "`.<br>3. Place order. | `name-error` visible matching `/full name/i`; `aria-invalid="true"`; confirmation count 0. | Error displayed; `aria-invalid="true"`; confirmation count 0. | **PASS** |
| **TC-06** | Product line removal | 1. Add Notebook + Pen Set ($16.50).<br>2. Click Remove Notebook. | `cart-line-notebook` count 0; order total updates to `$12.00`. | Notebook line removed; total updated to `$12.00`. | **PASS** |
| **TC-07** | Quantity minimum boundary & clamping | 1. Add Notebook.<br>2. Verify minus button disabled at qty 1.<br>3. Input 0, -3, blank, "2.7", "abc". | Minus button disabled; all invalid inputs clamp to 1 ($4.50). | Minus button disabled; all tested inputs clamped to 1 with total `$4.50`. | **PASS** |
| **TC-08** | Quantity maximum boundary (99) | 1. Set quantity to 99.<br>2. Verify plus button disabled & message visible.<br>3. Input 200.<br>4. Click "Add to Cart" at 99. | Plus button disabled; "Maximum quantity is 99." displayed; 200 clamps to 99 ($445.50); adding at 99 keeps 99. | Plus button disabled; status message visible; clamps to 99 ($445.50); retains 99 on add. | **PASS** |
| **TC-09a** | Rapid submit via evaluate clicks | 1. Fill valid order.<br>2. Trigger 3 consecutive clicks inside single evaluate.<br>3. Fire repeat click. | Exactly 1 confirmation; exactly 1 order reference; reference text stable and unchanged. | Exactly 1 confirmation; 1 reference code; unchanged reference text. | **PASS** |
| **TC-09b** | Real mouse double-click at button coordinates | 1. Fill valid order.<br>2. Read button bounding box.<br>3. Fire `page.mouse.dblclick(x, y)` at button center. | Exactly 1 confirmation and 1 order reference; confirmation remains visible (did not dismiss or click Start new order). | Exactly 1 confirmation and 1 reference; confirmation remains visible. | **PASS** |
| **TC-09c** | Repeated Enter on live name input | 1. Fill valid order.<br>2. Dispatch 3 keydown Enter events on name input inside evaluate. | Exactly 1 confirmation and 1 order reference; reference text stable and unchanged. | Exactly 1 confirmation and 1 reference; unchanged reference text. | **PASS** |
| **TC-09d** | Submission guard holds after success | 1. Fill and place valid order.<br>2. Attempt `.click()` on disabled button and Enter keydown on input. | Guard holds: exactly 1 confirmation; reference text remains identical. | Guard held; 1 confirmation and identical reference code maintained. | **PASS** |
| **TC-10** | Start new order full reset | 1. Complete order.<br>2. Click "Start new order". | Checkout view restored; Place Order enabled; cart empty; total `$0.00`; name cleared; confirmation count 0. | All state reset cleanly; confirmation count 0; Place Order enabled. | **PASS** |
| **TC-11** | Second order reference uniqueness | 1. Place order 1, record reference.<br>2. Start new order.<br>3. Place order 2, record reference. | Second order succeeds; reference 2 matches regex and is distinct from reference 1. | Both orders confirmed; references distinct (`ref1 !== ref2`). | **PASS** |
| **TC-12** | Totals calculation through multiple additions/removals | 1. Add 2 Notebooks + 1 Pen Set ($21.00).<br>2. Remove Pen Set ($9.00).<br>3. Remove Notebook. | Total updates to `$9.00`, then `$0.00`; empty cart message displays. | Total updated to `$9.00`, then `$0.00`; empty cart message shown. | **PASS** |
| **TC-13** | Name length limits & XSS prevention | 1. Check `maxlength="60"`.<br>2. Enter `<script>alert("xss")</script><b>BoldName</b>`.<br>3. Place order. | Name input restricted to 60 chars; confirmation renders raw text literally; zero `<b>` DOM elements created. | Input has `maxlength="60"`; literal text rendered safely via `textContent`; 0 `<b>` elements. | **PASS** |
| **TC-14** | Clean console verification | Listen for `pageerror` and `console.error` across an entire user journey (add, errors, qty edits, place order, reset). | Zero console errors and zero uncaught page errors. | 0 errors recorded across the entire session. | **PASS** |
| **TC-15** | D-02 Regression: Swallowed click prevention | 1. Add Notebook.<br>2. Fill '5' without Tab, click '+' immediately.<br>3. Fill '5' without Tab, click Remove immediately. | Quantity becomes 6 ($27.00) without click swallowing; line removed (count 0) and total `$0.00`. | Quantity reached 6 ($27.00); line removed upon Remove click; zero swallowed clicks. | **PASS** |

### 5.3 Server Suite (`server.spec.ts` — TC-16 through TC-20, no browser)

Risk: exposure of server source or files outside the web root, and unhandled server errors. Preconditions for all: server running via the Playwright `webServer` on `http://127.0.0.1:3000`. Results are from Environment B (see `RESULTS.md`). Raw traversal paths (`/../`, `%2e%2e`) are normalised by Playwright's HTTP client, so they are covered by curl `--path-as-is` probes instead.

| Test ID | Scenario | Steps | Expected Result | Actual Result | Status | Evidence |
|:---:|:---|:---|:---|:---|:---:|:---|
| **TC-16** | Public page served correctly | GET `/` and `/index.html`. | 200, `text/html`, `X-Content-Type-Options: nosniff`, body contains "Mini Checkout". | As expected. | **PASS** | `evidence/logs/server-run-1..3.txt`, `sandbox-run-1..3.txt` |
| **TC-17** | Server source / unknown files not exposed (S-01) | GET `/server.js`, `/app/server.js`, `/nope.html`, `/package.json`. | 404 for all; body does not contain server source. | 404 for all. Original server returned 200 for `/server.js` (test fails there). | **PASS** | `evidence/logs/server-probes.txt` |
| **TC-18** | Disallowed methods (S-02) | POST, PUT, DELETE, PATCH to `/`. | 405 with `Allow: GET, HEAD`. | As expected. Original server returned 200 for POST. | **PASS** | `evidence/logs/server-probes.txt` |
| **TC-19** | HEAD handling (S-02) | HEAD `/`. | 200, `text/html`, empty body. | As expected. | **PASS** | `evidence/logs/server-run-1..3.txt` |
| **TC-20** | Malformed URLs (S-03) | GET `/%E0%A4%A`, `/%00`, `/index.html%00.png`, then GET `/`. | 400 for the bad URLs; server still serves `/` with 200. | As expected. | **PASS** | `evidence/logs/server-probes.txt` |
| **Probe-only** | Traversal (curl `--path-as-is`) | GET `/../package.json`, `/%2e%2e/package.json`. | 403 (or 404). | 403 for both after the fix (original: 403 and 404). | **PASS** | `evidence/logs/server-probes.txt` |

---

## 6. Manual Exploratory Test Records

*Note: Automated Playwright tests are not manual tests and are not relabelled as such. Because no interactive desktop browser was available to a human operator in this automated audit session, manual test executions are marked PENDING with step-by-step instructions for human reproduction.*

### MT-01: Empty Cart Submission
- **Preconditions**: Application running at `http://127.0.0.1:3000` via `npm start`.
- **Steps**:
  1. Open browser to `http://127.0.0.1:3000`.
  2. Verify cart displays empty message and total is `$0.00`.
  3. In the "Full Name" input, enter `"Alice Walker"`.
  4. Click the "Place Order" button.
- **Expected Result**:
  - `cart-error` banner is displayed with text: *"Your cart is empty — please add at least one item before placing an order."*
  - Name input retains `"Alice Walker"`.
  - Order total remains `$0.00`.
  - No order confirmation is shown.
- **Actual Result**: *(Pending execution by a human tester in an interactive browser)*
- **Status**: **PENDING**

### MT-02: Rapid Double-Click Submission
- **Preconditions**: Application running at `http://127.0.0.1:3000` via `npm start`.
- **Steps**:
  1. Open browser to `http://127.0.0.1:3000`.
  2. Click "Add to Cart" on Notebook ($4.50).
  3. In the "Full Name" input, enter `"Charlie Brown"`.
  4. Rapidly double-click the "Place Order" button as fast as possible.
- **Expected Result**:
  - Exactly one order confirmation card appears.
  - Exactly one reference code starting with `ORD-` is displayed.
  - Confirmation remains visible and does not dismiss or trigger subsequent actions.
- **Actual Result**: *(Pending execution by a human tester in an interactive browser)*
- **Status**: **PENDING**

---

## 7. Not Tested / Residual Risks

| Item | Reason Not Tested | Residual Risk Assessment | Status |
|:---|:---|:---|:---:|
| **Cross-Browser (Safari / Firefox / Edge)** | Project specification strictly scopes execution to Chromium. | Low. Application uses standard DOM APIs and CSS without vendor prefixes. | **NOT TESTED** |
| **Physical Assistive Technology Audio Output** | Automated suite verifies ARIA attributes (`alert`, `status`, `aria-invalid`, `aria-label`); requires physical human screen reader tester. | Low. Accessibility tree attributes verified in automated tests. | **NOT TESTED** |
| **Multi-tab Reference Collision** | Client uses in-memory session Set; does not communicate across independent browser tabs. | Very Low. 8 alphanumeric characters provide $36^8 \approx 2.8 \times 10^{12}$ combinations. | **NOT TESTED** |
| **Distributed Backend Persistence** | Frontend-only architecture by specification design. | Zero risk within project scope. | **NOT TESTED** |
