# Mini Checkout and Browser Test Suite

A deterministic, lightweight single-page checkout built with vanilla HTML/CSS/JavaScript and zero runtime frameworks. Tested end-to-end with Playwright and Chromium, and served by a tiny static file server using Node's built-in `http` module.

---

## Table of Contents
1. [Overview & Features](#overview--features)
2. [Technology Stack & Dependency Versions](#technology-stack--dependency-versions)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Installation & Setup](#installation--setup)
6. [Starting the Application](#starting-the-application)
7. [Running the Automated Tests](#running-the-automated-tests)
8. [Automated Evidence Collection](#automated-evidence-collection)
9. [Viewing Test Reports](#viewing-test-reports)
10. [Manual Exploratory Testing (MT-01 & MT-02)](#manual-exploratory-testing-mt-01--mt-02)
11. [Design Decisions & Architecture](#design-decisions--architecture)
12. [Uniqueness Limitation](#uniqueness-limitation)

---

## Overview & Features

### Core Products
- **Notebook**: 450 integer cents ($4.50)
- **Pen Set**: 1200 integer cents ($12.00)

### Cart & Quantity Rules
- **Add to Cart**: Adds product with quantity 1 if not present; increments quantity by 1 if already in cart.
- **Quantity Clamping (1–99)**: Inputs clamp to integer range `[1, 99]`. Blank, `0`, negative numbers, decimals (`"2.7"` via `Number.isInteger`), or non-numeric strings (`"abc"`) clamp to `1`. Values above `99` clamp to `99`.
- **Quantity Limits UX**: The minus (`−`) button is disabled when quantity is `1`. The plus (`+`) button is disabled when quantity reaches `99`. At quantity `99`, a status message displays `"Maximum quantity is 99."` (`data-testid="qty-max-message"`). Clicking "Add to Cart" on an item already at `99` retains `99` and displays the message.
- **In-Place Updates (Zero Swallowed Clicks)**: Quantity edits update existing DOM elements in place (`updateLineInPlace`) without destroying DOM trees on `focusout`, ensuring immediate click registration on adjacent controls (e.g. `+`, `−`, `Remove`).
- **Line Removal**: The "Remove" button is the sole mechanism to delete an item line from the cart. Decrementing via minus stops at `1`.

### Checkout & Validation Rules
- **Validation Order**: Validates the cart first, then the customer full name. Displays all applicable errors without silent skipping.
- **Empty Cart Guard**: Blocks checkout, displaying an alert in `cart-error` with `"cart is empty"`.
- **Full Name Guard**: Required, trimmed field. Whitespace-only values count as blank. Displays an alert in `name-error` with `"full name"`, sets `aria-invalid="true"`, and focuses the input. Maximum length is 60 characters (`maxlength="60"`). Error clears live as soon as valid characters are entered.
- **Cart Error Clearing on Add**: Adding any product clears `cart-error`.
- **State Preservation**: Cart lines and typed name are preserved upon failed validation.
- **Double-Submit Protection**: Guard flag is set only after all validations pass, immediately prior to DOM manipulation. Failed validation never locks the guard. Rapid clicks and Enter keypresses produce exactly one confirmation and one order reference.
- **Order Confirmation Snapshot**: Takes an immutable snapshot of order state upon submission. Safely renders reference code (`ORD-` + 8 alphanumerics), customer name, readable date/time inside `<time datetime="ISO">`, itemised breakdown, and "Order total".
- **Start New Order**: Fully resets cart, name input, errors, submission guard, and confirmation view, returning to a clean initial state.
- **Clean Ephemeral State**: Zero persistence (`localStorage`, `sessionStorage`, or cookies). Reloading the browser yields a completely clean state.

---

## Technology Stack & Dependency Versions

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+). Zero external frameworks, libraries, or CDNs.
- **Server**: Node.js built-in `node:http`, `node:fs`, and `node:path`. Zero production dependencies.
- **Test Automation**: `@playwright/test` with Chromium browser automation.

### Package Dependency Version Specification
| Item | Value | Explanation |
|:---|:---|:---|
| **Declared DevDependency** | `"^1.52.0"` | Stated in `package.json`. The caret (`^`) denotes a semver compatibility range allowing minor and patch updates compatible with `1.x.x` (>= 1.52.0, < 2.0.0). |
| **Installed / Resolved Version** | `1.65.1` | Exact version resolved by npm and pinned in `package-lock.json` (`npm ls @playwright/test`). |
| **Playwright CLI Version** | `1.65.1` | Output of `npx playwright --version`. |
| **Managed Browser Binary** | Chromium `159.0.8154.6` | Verified via browser instance launch. |

---

## Project Structure

```
Mini-Checkout/
├── app/
│   ├── index.html              # Single-page checkout application
│   └── server.js               # Minimal Node.js static server with security checks
├── tests/
│   ├── checkout.spec.ts        # Main suite: Exactly 3 checks (TC-01, TC-02, TC-03)
│   ├── exploratory.spec.ts     # Exploratory suite: TC-04 through TC-15
│   └── server.spec.ts          # Static-server security/protocol tests: TC-16 through TC-20 (no browser)
├── scripts/
│   └── collect-evidence.js     # Automates 3 runs, capturing UTF-8 logs and JSON reports
├── evidence/
│   ├── screenshots/            # Verified visual evidence
│   │   ├── successful-checkout.png
│   │   ├── missing-name.png
│   │   ├── empty-cart.png
│   │   └── double-click.png
│   ├── logs/                   # Verbatim execution logs (UTF-8)
│   │   ├── baseline-D01.txt    # Reproduction of Defect D-01
│   │   ├── D02-before-fix.txt  # Reproduction of Defect D-02
│   │   ├── run-1.txt … run-3.txt             # Environment A browser-suite runs (pre server fix)
│   │   ├── server-probes.txt                 # curl probes: server BEFORE and AFTER the S-01/S-02/S-03 fixes
│   │   ├── server-run-1.txt … server-run-3.txt   # server.spec.ts runs (Environment B)
│   │   ├── sandbox-run-1.txt … sandbox-run-3.txt # full 23-test runs (Environment B)
│   │   └── sandbox-full-suite-attempt.txt    # failed attempt with the default Chromium (NOT a test result)
│   └── reports/                # Playwright JSON reporter outputs
│       ├── results-run-1.json
│       ├── results-run-2.json
│       ├── results-run-3.json
│       ├── results-latest.json               # Environment A, copy of run 3
│       ├── server-run-1.json … server-run-3.json
│       └── sandbox-run-1.json … sandbox-run-3.json
├── playwright.config.ts        # Playwright configuration (webServer, reporters)
├── package.json                # npm scripts and devDependencies
├── package-lock.json           # Deterministic package lockfile
├── .gitignore                  # Ignores node_modules, test-results, reports, logs
├── README.md                   # This document
├── TEST_PLAN.md                # Comprehensive risk analysis and test specifications
└── RESULTS.md                  # Test execution results, defect log, and evidence index
```

---

## Prerequisites
- **Node.js**: v18.0.0 or later (Tested on `v24.21.0`)
- **npm**: v9.0.0 or later (Tested on `11.19.0`)
- **OS**: Windows, macOS, or Linux (Tested on Windows 11 Enterprise)

---

## Installation & Setup

1. Open a terminal and navigate to the project directory:
   ```powershell
   cd Mini-Checkout
   ```

2. Install the development dependency from lockfile:
   ```powershell
   npm install
   ```

3. Download the managed Chromium browser binary:
   ```powershell
   npx playwright install chromium
   ```

---

## Starting the Application

To run the local static server standalone:
```powershell
npm start
```
or:
```powershell
node app/server.js
```
The server will start listening at:
```
http://127.0.0.1:3000
```
To run on a custom port (e.g. 8080):
```powershell
node app/server.js 8080
```

---

## Running the Automated Tests

The test suite automatically launches the application using Playwright's integrated `webServer` configuration.

### 1. Run Full Suite (Headless)
Executes all 23 test cases (Main Suite TC-01 to TC-03 + Exploratory Suite TC-04 to TC-15 + Server Suite TC-16 to TC-20):
```powershell
npm test
```

### 2. Run Only Main Checks (`checkout.spec.ts`)
Executes the exactly three mandated checks:
```powershell
npx playwright test tests/checkout.spec.ts
```

### 3. Run Only Exploratory Checks (`exploratory.spec.ts`)
Executes TC-04 through TC-15:
```powershell
npx playwright test tests/exploratory.spec.ts
```

Run only the browser-free server tests (TC-16 to TC-20):
```powershell
npx playwright test tests/server.spec.ts
```

### 4. Run in Headed Mode
Runs tests with a visible browser window:
```powershell
npm run test:headed
```

---

## Automated Evidence Collection

To execute the suite 3 consecutive times, verify stability (0 flaky tests), and generate UTF-8 logs and JSON reports in `evidence/`:
```powershell
npm run test:evidence
```
or:
```powershell
node scripts/collect-evidence.js
```
Output artifacts:
- `evidence/logs/run-1.txt`, `run-2.txt`, `run-3.txt` (UTF-8 console list output)
- `evidence/reports/results-run-1.json`, `results-run-2.json`, `results-run-3.json`
- `evidence/reports/results-latest.json` (canonical copy of run 3)

Provenance note: `run-N` logs/reports, `results-*.json` and the four screenshots come from the original author's Windows run (Environment A in `RESULTS.md`, 18 tests, before the server fix). The `server-*` and `sandbox-*` files come from the audit sandbox (Environment B, 23 tests, after the fix). `RESULTS.md` labels each result with its environment.

---

## Viewing Test Reports

To inspect the built-in Playwright HTML report after a test run:
```powershell
npm run test:report
```

---

## Manual Exploratory Testing (MT-01 & MT-02)

For human testers conducting manual verification in an interactive desktop browser:

### MT-01: Empty Cart Validation
1. Start the server with `npm start` and navigate to `http://127.0.0.1:3000`.
2. Verify the initial state shows an empty cart message and total `$0.00`.
3. In the "Full Name" input, enter `"Alice Walker"`.
4. Click the "Place Order" button.
5. **Expected Observation**:
   - `cart-error` banner displays with text: *"Your cart is empty — please add at least one item before placing an order."*
   - Name input retains `"Alice Walker"`.
   - Cart line count remains 0; order total remains `$0.00`.
   - Confirmation is not displayed.

### MT-02: Rapid Double-Click Submission
1. Start the server with `npm start` and navigate to `http://127.0.0.1:3000`.
2. Click "Add to Cart" on the Notebook product.
3. In the "Full Name" input, enter `"Charlie Brown"`.
4. Rapidly double-click the "Place Order" button as fast as possible.
5. **Expected Observation**:
   - Exactly one order confirmation screen appears.
   - Exactly one reference code starting with `ORD-` is displayed.
   - The confirmation card remains visible and stable (does not dismiss or trigger subsequent actions).

---

## Design Decisions & Architecture

1. **Integer Cents Representation**: All monetary quantities are tracked as integer cents (e.g. Notebook = 450, Pen Set = 1200) across data structures. Conversion to dollars (`$0.00`) occurs solely at the rendering boundary via integer division and padding, preventing binary floating-point inaccuracies.
2. **Synchronous Submission Lock**: Double-submission guard sets `isSubmitting = true` synchronously before any DOM transformations. Failed validation never sets this flag.
3. **In-Place DOM Mutation (D-02 Fix)**: When quantity inputs change or blur, `updateLineInPlace()` modifies attributes and text nodes of existing elements rather than wiping out DOM children via `replaceChildren()`, avoiding swallowed clicks on adjacent buttons.
4. **Static Server Hardening (S-01/S-02/S-03)**: `server.js` accepts only GET and HEAD (405 + `Allow: GET, HEAD` otherwise); percent-decodes the path inside try/catch (400 for malformed encoding or null bytes); resolves it with `path.resolve` and requires the result to start with `ROOT + path.sep` (403 for traversal); serves only an explicit allow-list (`index.html`), so `server.js` itself returns 404; wraps the handler so nothing throws unhandled (500); and sends `X-Content-Type-Options: nosniff`. Evidence: `evidence/logs/server-probes.txt` and `tests/server.spec.ts`.
5. **Robust Date Formatting**: Uses standard ECMA-402 Intl fallback (`dateStyle: 'medium'`, `timeStyle: 'short'`, timezone `'UTC'`) plus `' UTC'` suffix to render deterministic date/time strings (`Nov 23, 2026, 12:00 PM UTC`).

---

## Uniqueness Limitation

The order reference collision check uses an in-memory JavaScript `Set` (`usedReferences`) scoped to the active page session. Across page reloads or independent browser tabs, reference uniqueness is governed by the 8-character uppercase alphanumeric pseudo-random space ($36^8 \approx 2.8 \times 10^{12}$ possibilities), but is not synchronised across distributed clients due to the client-only architecture.
