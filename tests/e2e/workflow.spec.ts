import { expect, test, type Page } from '@playwright/test';
import type { ClaimDetail } from '../../src/lib/types';

const origin = 'http://127.0.0.1:3108';
async function login(page: Page, name: string) {
  await page.goto('/login');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/claims$/);
  await expect(page.getByRole('heading', { name: /Your claims|Team claims/ })).toBeVisible();
}
async function confirmProfile(page: Page, email: string) {
  await page.goto('/settings');
  await page.getByLabel('PayPal email').fill(email);
  await page.getByRole('checkbox', { name: /I confirm that this is my own/ }).check();
  await page.getByRole('button', { name: 'Confirm recipient', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm account', exact: true }).click();
  await expect(page.locator('.profile-confirmed')).toBeVisible();
}
async function confirmAndSubmit(page: Page) {
  await page.getByRole('checkbox', { name: /I checked the merchant/ }).check();
  await page.getByRole('checkbox', { name: /I personally paid/ }).check();
  await page.getByRole('button', { name: 'Submit claim', exact: true }).click();
  await page.getByRole('button', { name: 'Submit for checks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Checks & next steps' })).toBeVisible();
}

test('member submits, finance approves exact recipient, and only reconciliation marks the simulated item paid', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'Alex Morgan');
  await confirmProfile(page, 'alex@example.test');
  await page.getByRole('link', { name: 'My claims', exact: true }).click();
  await page.getByRole('link', { name: 'New claim', exact: true }).click();
  await page.getByRole('button', { name: 'Clear · £23.80', exact: true }).click();
  await expect(page.getByLabel('Merchant', { exact: true })).toHaveValue('Northern Rail');
  await expect(page.getByText('Sample extraction', { exact: true })).toBeVisible();
  await confirmAndSubmit(page);
  const path = new URL(page.url()).pathname;
  const submitted = (await (await page.request.get(`/api${path}`)).json()) as ClaimDetail;
  expect(submitted.reviewStatus).toBe('needs_review');
  expect(submitted.paymentStatus).toBe('not_started');
  expect(submitted.versions).toHaveLength(1);
  expect(submitted.extraction?.category).toBe('transport');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await login(page, 'Morgan Chen');
  await page.goto(path);
  await page
    .getByLabel('Decision reason')
    .fill('Checked original paid rail receipt and the confirmed reimbursement details.');
  await page.getByRole('button', { name: 'Approve claim', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm approval', exact: true }).click();
  await page.getByRole('button', { name: 'Simulate approved payment', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('alex@example.test');
  await expect(page.getByRole('dialog')).toContainText('£23.80');
  await page.getByRole('button', { name: 'Confirm simulation', exact: true }).click();
  await expect(page.locator('.payment-panel .status-badge')).toHaveText('Processing');
  const processing = (await (await page.request.get(`/api${path}`)).json()) as ClaimDetail;
  expect(processing.payment?.transactionId).toBeNull();
  await page.getByRole('button', { name: 'Synchronize existing payment', exact: true }).click();
  await expect(page.locator('.payment-panel .status-badge')).toHaveText('Paid');
  const repeated = await page.request.post(`/api${path}/payment`, {
    headers: { Origin: origin },
    data: { expectedVersion: processing.version },
  });
  expect(repeated.ok()).toBeTruthy();
  const final = (await repeated.json()) as ClaimDetail;
  expect(final.payment?.id).toBe(processing.payment?.id);
  expect(final.payment?.transactionId).toMatch(/^demo-txn-/);
  await page.reload();
  await expect(page.locator('.payment-panel .status-badge')).toHaveText('Paid');
  await page.screenshot({ path: '.local/screenshots/e2e-paid-detail.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('blurry large receipt requests information and a clear replacement still needs finance', async ({
  page,
}) => {
  await login(page, 'Alex Morgan');
  await confirmProfile(page, 'alex@example.test');
  await page.goto('/claims/new');
  await page.getByRole('button', { name: 'Blurry · £420', exact: true }).click();
  await expect(page.getByLabel('Amount to reimburse', { exact: true })).toHaveValue('420.00');
  await confirmAndSubmit(page);
  const path = new URL(page.url()).pathname;
  const original = (await (await page.request.get(`/api${path}`)).json()) as ClaimDetail;
  expect(original.reviewStatus).toBe('needs_info');
  expect(original.payment).toBeNull();
  expect(
    original.findings.some((f) => f.code === 'single_limit' && f.outcome === 'manual'),
  ).toBeTruthy();
  const replacement = await page.request.post(`/api${path}/sample`, {
    headers: { Origin: origin },
    data: { expectedVersion: original.version, sample: 'large_clear' },
  });
  expect(replacement.ok()).toBeTruthy();
  let current = (await replacement.json()) as ClaimDetail;
  const confirmed = await page.request.patch(`/api${path}`, {
    headers: { Origin: origin },
    data: { expectedVersion: current.version, fieldsConfirmed: true, paidConfirmed: true },
  });
  current = (await confirmed.json()) as ClaimDetail;
  const submitted = await page.request.post(`/api${path}/submit`, {
    headers: { Origin: origin },
    data: { expectedVersion: current.version },
  });
  current = (await submitted.json()) as ClaimDetail;
  expect(current.reviewStatus).toBe('needs_review');
  expect(current.payment).toBeNull();
  expect(current.amountMinor).toBe(42000);
  expect(current.versions).toHaveLength(2);
  expect(
    current.findings.some((f) => f.code === 'single_limit' && f.outcome === 'manual'),
  ).toBeTruthy();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Above the automatic limit', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Versions 2/ }).click();
  await expect(page.locator('.version-list details')).toHaveCount(2);
});

test('real route boundaries reject forged role, cross-origin actions and another member’s private records', async ({
  page,
  browser,
}) => {
  await login(page, 'Alex Morgan');
  const made = await page.request.post('/api/claims', { headers: { Origin: origin }, data: {} });
  const draft = (await made.json()) as ClaimDetail;
  const sample = await page.request.post(`/api/claims/${draft.id}/sample`, {
    headers: { Origin: origin },
    data: { expectedVersion: draft.version, sample: 'partial' },
  });
  const claim = (await sample.json()) as ClaimDetail;
  const forged = await page.request.patch(`/api/claims/${claim.id}`, {
    headers: { Origin: origin },
    data: { expectedVersion: claim.version, reviewStatus: 'approved' },
  });
  expect(forged.status()).toBe(400);
  const csrf = await page.request.post('/api/claims', {
    headers: { Origin: 'https://untrusted.example' },
    data: {},
  });
  expect(csrf.status()).toBe(403);
  const other = await browser.newContext({ baseURL: origin });
  await other.request.post('/api/auth/login', {
    headers: { Origin: origin },
    data: { demoUserId: 'sam' },
  });
  expect((await other.request.get(`/api/claims/${claim.id}`)).status()).toBe(404);
  expect((await other.request.get(`/api/attachments/${claim.attachments[0].id}`)).status()).toBe(
    404,
  );
  const csv = await (await other.request.get('/api/export')).text();
  expect(csv).not.toContain(claim.id);
  await other.close();
  await page
    .context()
    .addCookies([
      {
        name: 'carry_demo_session',
        value: 'morgan.9999999999999.forged',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
  expect((await page.request.get('/api/bootstrap')).status()).toBe(401);
});

test('mobile claims remain usable and authorized CSV downloads', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, 'Alex Morgan');
  await expect(page.getByRole('link', { name: 'New claim', exact: true })).toBeVisible();
  const width = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(width.document).toBeLessThanOrEqual(width.viewport + 1);
  await page.getByLabel('Search claims').fill('no-such-merchant');
  await expect(page.getByText('No claims match these filters.', { exact: true })).toBeVisible();
  await page.getByLabel('Search claims').clear();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Export CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('carry-claims.csv');
  await page.screenshot({ path: '.local/screenshots/e2e-claims-mobile.png', fullPage: true });
});
