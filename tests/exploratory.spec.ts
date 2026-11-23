/**
 * exploratory.spec.ts
 * ════════════════════════════════════════════════════════════════════════════
 * Scripted exploratory test suite (no interactive browser available).
 * Covers TC-04 through TC-15 (including D-02 regression).
 * Reported separately from the 3 main checks in checkout.spec.ts.
 *
 * NOTE on duplicate-submission testing:
 * Standard locator-level repeated clicks (e.g. locator.click() twice in series)
 * cannot test re-entrancy here because upon the first successful submission, the
 * checkout form view is synchronously hidden (display: none), causing Playwright
 * to wait indefinitely on the hidden element and time out. Instead:
 *  - TC-09a fires back-to-back click() calls directly on the live DOM element inside evaluate.
 *  - TC-09b performs a real hardware mouse double-click at the button's screen coordinates.
 *  - TC-09c dispatches rapid Enter keydown events on the live input inside evaluate.
 *  - TC-09d attempts to re-invoke submission on the disabled/hidden elements post-success.
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'evidence', 'screenshots');

// Helper to set quantity via evaluate (for non-numeric / decimal values)
async function setQtyViaEval(page: Page, testid: string, value: string) {
  await page.evaluate(({ testid, value }) => {
    const el = document.querySelector(`[data-testid="${testid}"]`) as HTMLInputElement;
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, { testid, value });
}

// ── TC-04: Empty cart validation blocks order and preserves name ────────────
test('TC-04: Empty cart blocks checkout and preserves typed name', async ({ page }) => {
  await page.goto('/');

  // Enter name with empty cart
  await page.getByLabel('Full Name').fill('Alice Walker');
  await page.getByRole('button', { name: 'Place Order' }).click();

  // Assert cart-error is visible and contains "cart is empty"
  const cartError = page.getByTestId('cart-error');
  await expect(cartError).toBeVisible();
  await expect(cartError).toHaveText(/cart is empty/i);

  // Assert no confirmation and cart is still empty
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();

  // Assert typed name is preserved
  await expect(page.getByLabel('Full Name')).toHaveValue('Alice Walker');

  // Save screenshot evidence
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'empty-cart.png'),
    fullPage: true,
  });
});

// ── TC-05: Whitespace-only name is treated as blank ─────────────────────────
test('TC-05: Whitespace-only name is blocked with aria-invalid', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('     ');
  await page.getByRole('button', { name: 'Place Order' }).click();

  await expect(page.getByTestId('name-error')).toBeVisible();
  await expect(page.getByTestId('name-error')).toHaveText(/full name/i);
  await expect(page.getByLabel('Full Name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
});

// ── TC-06: Remove a product from cart ───────────────────────────────────────
test('TC-06: Removing a product removes its line and updates order total', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('$16.50');

  // Remove Notebook
  await page.getByRole('button', { name: 'Remove Notebook from cart' }).click();
  await expect(page.getByTestId('cart-line-notebook')).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('$12.00');
});

// ── TC-07: Quantity minimum and invalid input clamping ──────────────────────
test('TC-07: Quantity minimum clamps to 1 and minus button is disabled', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();

  // At qty = 1, minus button must be disabled
  const minusBtn = page.getByRole('button', { name: 'Decrease quantity of Notebook' });
  await expect(minusBtn).toBeDisabled();

  // Test 0 clamps to 1
  await setQtyViaEval(page, 'qty-notebook', '0');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('1');

  // Test -3 clamps to 1
  await setQtyViaEval(page, 'qty-notebook', '-3');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('1');

  // Test blank clamps to 1
  await setQtyViaEval(page, 'qty-notebook', '');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('1');

  // Test decimal "2.7" clamps to 1 (Number.isInteger fails)
  await setQtyViaEval(page, 'qty-notebook', '2.7');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('1');

  // Test non-numeric "abc" clamps to 1
  await setQtyViaEval(page, 'qty-notebook', 'abc');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('1');
});

// ── TC-08: Quantity maximum at 99 ───────────────────────────────────────────
test('TC-08: Quantity maximum at 99 disables plus button and displays notice', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();

  // Set quantity to 99
  await page.getByLabel('Quantity for Notebook').fill('99');
  await page.getByLabel('Quantity for Notebook').press('Tab');

  // Plus button disabled and status notice visible
  const plusBtn = page.getByRole('button', { name: 'Increase quantity of Notebook' });
  await expect(plusBtn).toBeDisabled();
  await expect(page.getByTestId('qty-max-message')).toBeVisible();
  await expect(page.getByTestId('qty-max-message')).toHaveText('Maximum quantity is 99.');

  // Set over 99 (e.g. 200) clamps to 99: 99 * $4.50 = $445.50
  await page.getByLabel('Quantity for Notebook').fill('200');
  await page.getByLabel('Quantity for Notebook').press('Tab');
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('99');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$445.50');
  await expect(page.getByTestId('order-total')).toHaveText('$445.50');

  // Clicking Add to Cart on product already at 99 keeps 99
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('99');
  await expect(page.getByTestId('order-total')).toHaveText('$445.50');
  await expect(page.getByTestId('qty-max-message')).toBeVisible();
});

// ── TC-09a: Rapid submission via evaluate clicks produces exactly one order ──
test('TC-09a: Rapid evaluate-clicks produce exactly one confirmation and reference', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('Charlie Brown');

  // Fire 3 clicks back-to-back inside one evaluate on the live DOM button
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="place-order"]') as HTMLButtonElement;
    btn.click();
    btn.click();
    btn.click();
  });

  // Verify single confirmation and reference
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);

  const ref1 = await page.getByTestId('order-reference').textContent();
  expect(ref1).toMatch(/^ORD-[A-Z0-9]{8}$/);

  // Repeat clicks and verify reference remains completely unchanged
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="place-order"]') as HTMLButtonElement | null;
    if (btn) btn.click();
  });

  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(ref1!);

  // Save screenshot evidence after verifying stability
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'double-click.png'),
    fullPage: true,
  });
});

// ── TC-09b: Real mouse double-click at button coordinates ────────────────────
test('TC-09b: Real mouse double-click at button coordinates produces single confirmation', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();
  await page.getByLabel('Full Name').fill('Dana Scully');

  const btn = page.getByRole('button', { name: 'Place Order' });
  const box = await btn.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  // Real mouse double click at coordinate center
  await page.mouse.dblclick(x, y);

  // Exactly one confirmation and one reference
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);

  // Assert confirmation is still visible and did not trigger "Start new order"
  await expect(page.getByTestId('confirmation')).toBeVisible();
});

// ── TC-09c: Repeated Enter on live name input ────────────────────────────────
test('TC-09c: Repeated Enter on live name input produces exactly one confirmation', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('Fox Mulder');

  // Dispatch three keydown Enter events on the live name input inside evaluate
  await page.evaluate(() => {
    const input = document.querySelector('[data-testid="name-input"]') as HTMLInputElement;
    const evt = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
    input.dispatchEvent(evt);
    input.dispatchEvent(evt);
    input.dispatchEvent(evt);
  });

  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);

  const ref = await page.getByTestId('order-reference').textContent();
  expect(ref).toMatch(/^ORD-[A-Z0-9]{8}$/);
  await expect(page.getByTestId('order-reference')).toHaveText(ref!);
});

// ── TC-09d: Guard holds after success ───────────────────────────────────────
test('TC-09d: Submission guard holds after success against subsequent clicks and Enter', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('Walter Skinner');
  await page.getByRole('button', { name: 'Place Order' }).click();

  await expect(page.getByTestId('confirmation')).toBeVisible();
  const ref = await page.getByTestId('order-reference').textContent();

  // Attempt click on disabled button and Enter on name input via evaluate
  await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="place-order"]') as HTMLButtonElement | null;
    if (btn) btn.click();
    const input = document.querySelector('[data-testid="name-input"]') as HTMLInputElement | null;
    if (input) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    }
  });

  // Guard must hold: still exactly one confirmation with identical reference
  await expect(page.getByTestId('confirmation')).toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveText(ref!);
});

// ── TC-10: Start new order fully resets state ───────────────────────────────
test('TC-10: Start new order resets cart, name, errors, and confirmation', async ({ page }) => {
  await page.goto('/');

  // Place initial order
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('George Costanza');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  // Click start new order
  await page.getByRole('button', { name: 'Start new order' }).click();

  // Checkout view restored
  await expect(page.getByRole('button', { name: 'Place Order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Place Order' })).toBeEnabled();

  // State cleared
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByLabel('Full Name')).toHaveValue('');
  await expect(page.getByTestId('name-error')).not.toBeVisible();
  await expect(page.getByTestId('cart-error')).not.toBeVisible();
  await expect(page.getByTestId('confirmation')).toHaveCount(0);
});

// ── TC-11: Second order succeeds and produces a unique reference ────────────
test('TC-11: Second order succeeds with a distinct reference', async ({ page }) => {
  await page.goto('/');

  // First order
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Full Name').fill('Buyer One');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  const ref1 = await page.getByTestId('order-reference').textContent();
  expect(ref1).toMatch(/^ORD-[A-Z0-9]{8}$/);

  // Reset
  await page.getByRole('button', { name: 'Start new order' }).click();

  // Second order
  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();
  await page.getByLabel('Full Name').fill('Buyer Two');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  const ref2 = await page.getByTestId('order-reference').textContent();
  expect(ref2).toMatch(/^ORD-[A-Z0-9]{8}$/);
  expect(ref2).not.toEqual(ref1);
});

// ── TC-12: Totals calculation after line removals ───────────────────────────
test('TC-12: Totals calculate accurately through additions and removals', async ({ page }) => {
  await page.goto('/');

  // 2 Notebooks ($9.00) + 1 Pen Set ($12.00) = $21.00
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByLabel('Quantity for Notebook').fill('2');
  await page.getByLabel('Quantity for Notebook').press('Tab');
  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('$21.00');

  // Remove Pen Set -> $9.00
  await page.getByRole('button', { name: 'Remove Pen Set from cart' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('$9.00');

  // Remove Notebook -> $0.00 and empty cart message visible
  await page.getByRole('button', { name: 'Remove Notebook from cart' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
});

// ── TC-13: Name limits and XSS safe rendering ─────────────────────────
test('TC-13: Name maxlength enforced and user input rendered safely', async ({ page }) => {
  await page.goto('/');

  const nameInput = page.getByLabel('Full Name');
  await expect(nameInput).toHaveAttribute('maxlength', '60');

  // Test safe rendering of HTML characters
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  const xssPayload = '<script>alert("xss")</script><b>BoldName</b>';
  await nameInput.fill(xssPayload);
  await page.getByRole('button', { name: 'Place Order' }).click();

  // Confirmation must display exact literal text, not parsed HTML
  await expect(page.getByTestId('confirmation-name')).toHaveText(xssPayload);
  // Verify no <b> element was rendered inside confirmation-name
  const boldTags = page.locator('[data-testid="confirmation-name"] b');
  await expect(boldTags).toHaveCount(0);
});

// ── TC-14: Clean console across full user journey ───────────────────────────
test('TC-14: Zero console errors or page errors across a full customer journey', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`[PageError] ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[ConsoleError] ${msg.text()}`);
  });

  await page.goto('/');

  // 1. Trigger cart error
  await page.getByRole('button', { name: 'Place Order' }).click();

  // 2. Add products and trigger name error
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await page.getByRole('button', { name: 'Place Order' }).click();

  // 3. Edit quantities, hit max boundary
  await page.getByLabel('Quantity for Notebook').fill('99');
  await page.getByLabel('Quantity for Notebook').press('Tab');
  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();

  // 4. Fill name and submit
  await page.getByLabel('Full Name').fill('Clean Console Journey');
  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByTestId('confirmation')).toBeVisible();

  // 5. Start new order
  await page.getByRole('button', { name: 'Start new order' }).click();
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();

  // Assert absolutely zero console or page errors were encountered
  expect(errors).toEqual([]);
});

// ── TC-15: D-02 Regression - quantity edit without Tab followed by click ─────
test('TC-15: D-02 Regression - quantity edit without Tab immediately registers button clicks', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  // Fill '5' without pressing Tab, then click '+' immediately
  await page.getByLabel('Quantity for Notebook').fill('5');
  await page.getByRole('button', { name: 'Increase quantity of Notebook' }).click();

  // Quantity must become 6 and line total $27.00 (not swallowed at 5 / $22.50)
  await expect(page.getByLabel('Quantity for Notebook')).toHaveValue('6');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$27.00');
  await expect(page.getByTestId('order-total')).toHaveText('$27.00');

  // Fill '5' without pressing Tab, then click Remove immediately
  await page.getByLabel('Quantity for Notebook').fill('5');
  await page.getByRole('button', { name: 'Remove Notebook from cart' }).click();

  // Line must be removed (count 0) and total $0.00
  await expect(page.getByTestId('cart-line-notebook')).toHaveCount(0);
  await expect(page.getByTestId('order-total')).toHaveText('$0.00');
  await expect(page.getByTestId('cart-empty-message')).toBeVisible();
});
