/**
 * server.spec.ts
 * ════════════════════════════════════════════════════════════════════════════
 * Static-server security and protocol tests (S-01, S-02, S-03).
 *
 * Uses Playwright's `request` fixture only: no browser is launched.
 * Raw traversal paths (/../ and %2e%2e) are normalised by the WHATWG URL
 * parser inside Playwright's HTTP client, so they cannot be sent faithfully
 * from here. They are covered by curl --path-as-is probes instead:
 * see evidence/logs/server-probes.txt.
 */

import { test, expect } from '@playwright/test';

test('TC-16: Public page is served with the correct type and nosniff', async ({ request }) => {
  for (const url of ['/', '/index.html']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(await res.text()).toContain('Mini Checkout');
  }
});

test('TC-17: Server source and unknown files are not exposed (S-01)', async ({ request }) => {
  for (const url of ['/server.js', '/app/server.js', '/nope.html', '/package.json']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(404);
    expect(await res.text(), url).not.toContain('createServer');
  }
});

test('TC-18: Methods other than GET and HEAD return 405 with Allow (S-02)', async ({ request }) => {
  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const res = await request.fetch('/', { method });
    expect(res.status(), method).toBe(405);
    expect(res.headers()['allow']).toBe('GET, HEAD');
  }
});

test('TC-19: HEAD returns headers and no body (S-02)', async ({ request }) => {
  const res = await request.head('/');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('text/html');
  expect((await res.body()).length).toBe(0);
});

test('TC-20: Malformed encoding and null bytes return 400 and the server survives (S-03)', async ({ request }) => {
  for (const url of ['/%E0%A4%A', '/%00', '/index.html%00.png']) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(400);
  }
  const healthy = await request.get('/');
  expect(healthy.status()).toBe(200);
});
