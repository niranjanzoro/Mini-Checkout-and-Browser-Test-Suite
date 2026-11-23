/**
 * checkout.spec.ts
 * ════════════════════════════════════════════════════════════════════════════
 * Contains exactly THREE test() blocks: TC-01, TC-02, TC-03.
 *
 * Rules:
 *  - Fresh context per test via page.goto('/').
 *  - Web-first assertions only; no waitForTimeout or arbitrary sleeps.
 *  - Accessible locators preferred (getByRole, getByLabel).
 *  - Quantity edits use fill() followed by press('Tab').
 */

import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'evidence', 'screenshots');

// ── TC-01: Successful checkout shows a confirmation ─────────────────────────
test('TC-01: Successful checkout shows a confirmation', async ({ page }) => {
  // Fixed clock for deterministic date/time assertion
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00.000Z'));
  await page.goto('/');

  // Add Notebook ($4.50)
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$4.50');

  // Fill in customer name
  await page.getByLabel('Full Name').fill('Jane Doe');

  // Place order
  await page.getByRole('button', { name: 'Place Order' }).click();

  // Assert confirmation is visible with "Order confirmed" heading
  const confirmation = page.getByTestId('confirmation');
  await expect(confirmation).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();

  // Exactly one confirmation and one order-reference element in DOM
  await expect(page.getByTestId('confirmation')).toHaveCount(1);
  await expect(page.getByTestId('order-reference')).toHaveCount(1);

  // Assert customer name shown
  await expect(page.getByTestId('confirmation-name')).toHaveText('Jane Doe');

  // Assert reference format: ORD- + 8 uppercase alphanumerics
  await expect(page.getByTestId('order-reference')).toHaveText(/^ORD-[A-Z0-9]{8}$/);

  // Assert readable date/time text and datetime attribute on <time> element
  const timeEl = page.getByTestId('confirmation-datetime');
  await expect(timeEl).toHaveText('Nov 23, 2026, 12:00 PM UTC');
  await expect(timeEl).toHaveAttribute('datetime', '2026-11-23T12:00:00.000Z');

  // Assert totals and items
  await expect(page.getByTestId('confirmation-total')).toHaveText('$4.50');
  await expect(page.getByTestId('confirmation-items')).toBeVisible();

  // Save evidence screenshot
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'successful-checkout.png'),
    fullPage: true,
  });
});

// ── TC-02: Missing name blocks checkout and preserves the cart ───────────────
test('TC-02: Missing name blocks checkout and preserves the cart', async ({ page }) => {
  await page.goto('/');

  // Add Notebook ($4.50)
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$4.50');

  // Leave name blank and attempt to place order
  await page.getByRole('button', { name: 'Place Order' }).click();

  // Assert name-error is visible, role="alert", and matches /full name/i
  const nameError = page.getByTestId('name-error');
  await expect(nameError).toBeVisible();
  await expect(nameError).toHaveText(/full name/i);
  await expect(page.getByLabel('Full Name')).toHaveAttribute('aria-invalid', 'true');

  // Assert no confirmation appeared
  await expect(page.getByTestId('confirmation')).toHaveCount(0);

  // Assert cart line and total are preserved
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();
  await expect(page.getByTestId('order-total')).toHaveText('$4.50');

  // Save evidence screenshot of validation block
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'missing-name.png'),
    fullPage: true,
  });

  // Enter a valid name, resubmit, and verify guard did not lock
  await page.getByLabel('Full Name').fill('Bob Smith');
  await expect(nameError).not.toBeVisible();
  await expect(page.getByLabel('Full Name')).not.toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'Place Order' }).click();
  await expect(page.getByTestId('confirmation')).toBeVisible();
});

// ── TC-03: Quantity calculation updates exact totals ─────────────────────────
test('TC-03: Quantity calculation updates exact totals', async ({ page }) => {
  await page.goto('/');

  // Add Notebook and set quantity to 2 -> 2 * $4.50 = $9.00
  await page.getByRole('button', { name: 'Add Notebook to cart' }).click();
  await expect(page.getByTestId('cart-line-notebook')).toBeVisible();

  await page.getByLabel('Quantity for Notebook').fill('2');
  await page.getByLabel('Quantity for Notebook').press('Tab');

  await expect(page.getByTestId('line-total-notebook')).toHaveText('$9.00');
  await expect(page.getByTestId('order-total')).toHaveText('$9.00');

  // Add Pen Set (1 * $12.00) -> order total $9.00 + $12.00 = $21.00
  await page.getByRole('button', { name: 'Add Pen Set to cart' }).click();
  await expect(page.getByTestId('cart-line-pen')).toBeVisible();
  await expect(page.getByTestId('line-total-pen')).toHaveText('$12.00');
  await expect(page.getByTestId('order-total')).toHaveText('$21.00');

  // Change Pen Set quantity to 3 -> 3 * $12.00 = $36.00, order total $9.00 + $36.00 = $45.00
  await page.getByLabel('Quantity for Pen Set').fill('3');
  await page.getByLabel('Quantity for Pen Set').press('Tab');
  await expect(page.getByTestId('line-total-pen')).toHaveText('$36.00');
  await expect(page.getByTestId('order-total')).toHaveText('$45.00');

  // Change Notebook quantity back to 1 -> 1 * $4.50 = $4.50, order total $4.50 + $36.00 = $40.50
  await page.getByLabel('Quantity for Notebook').fill('1');
  await page.getByLabel('Quantity for Notebook').press('Tab');
  await expect(page.getByTestId('line-total-notebook')).toHaveText('$4.50');
  await expect(page.getByTestId('order-total')).toHaveText('$40.50');
});
