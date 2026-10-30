import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase, type Database } from '../src/lib/db/database';
import { createDemoState } from '../src/lib/db/demo';
import { ReimbursementService } from '../src/lib/domain/service';
import { parseMoney } from '../src/lib/domain/rules';
import type {
  ClaimDetail,
  Extraction,
  PaymentIntent,
  VerifiedPaymentResult,
} from '../src/lib/types';

let db: Database;
let service: ReimbursementService;
let now = '2026-10-30T12:00:00.000Z';
beforeEach(async () => {
  now = '2026-10-30T12:00:00.000Z';
  db = await createDatabase();
  await db.seed(createDemoState(now, false));
  service = new ReimbursementService(db, { clock: () => new Date(now) });
  await service.updateProfile('alex', { email: 'alex.paypal@example.test', confirmed: true });
});
afterEach(async () => {
  await db.close();
});

async function policy(enabled = true, extra = {}) {
  const { policy: current } = await service.bootstrap('morgan');
  return service.updatePolicy('morgan', current.version, {
    autoPaymentEnabled: enabled,
    autoCategories: current.autoCategories,
    singleLimitMinor: current.singleLimitMinor,
    monthlyLimitMinor: current.monthlyLimitMinor,
    maxAgeDays: current.maxAgeDays,
    ...extra,
  });
}
function extraction(claim: ClaimDetail, overrides: Partial<Extraction> = {}): Extraction {
  const a = claim.attachments[0];
  return {
    merchant: claim.merchant,
    date: claim.date,
    totalMinor: claim.amountMinor,
    currency: 'GBP',
    category: claim.category,
    receiptNumber: `RECEIPT-${claim.id}`,
    items: [{ description: 'Paid travel', amountMinor: claim.amountMinor }],
    sources: ['merchant', 'date', 'totalMinor', 'currency', 'category'].map((field) => ({
      attachmentId: a.id,
      page: 1,
      quote: `Evidence for ${field}`,
      field,
    })),
    issues: [],
    paidEvidence: true,
    purposeMatches: true,
    status: 'complete',
    provider: 'demo',
    model: 'test-fixture',
    ...overrides,
  };
}
async function ready(
  amountMinor = 2380,
  extra: Partial<ClaimDetail> = {},
  hash?: string,
): Promise<ClaimDetail> {
  let c = await service.createDraft('alex', {
    merchant: `Merchant ${randomUUID().slice(0, 8)}`,
    date: '2026-10-29',
    amountMinor,
    currency: 'GBP',
    category: 'transport',
    purpose: 'Client workshop travel',
    paymentNote: 'Paid by card, paid receipt attached.',
    paidConfirmed: true,
    ...extra,
  });
  c = await service.addAttachment('alex', c.id, c.version, {
    name: 'receipt.pdf',
    mediaType: 'application/pdf',
    size: 1000,
    sha256: hash ?? createHash('sha256').update(c.id).digest('hex'),
    pages: 1,
    storageKey: `northstar/alex/${c.id}/receipt.pdf`,
  });
  c = await service.saveExtraction('alex', c.id, c.version, extraction(c));
  return service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
}
async function approvedManual(amountMinor = 2380): Promise<ClaimDetail> {
  let c = await ready(amountMinor);
  c = await service.submit('alex', c.id, c.version);
  return service.review('morgan', c.id, c.version, {
    decision: 'approve',
    reason: 'Checked the receipt and supporting evidence.',
  });
}
function verified(
  intent: PaymentIntent,
  status: VerifiedPaymentResult['status'] = 'paid',
): VerifiedPaymentResult {
  return {
    status,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    recipientEmail: intent.recipientEmail,
    senderBatchId: intent.senderBatchId,
    senderItemId: intent.senderItemId,
    providerBatchId: 'BATCH-1',
    providerItemId: 'ITEM-1',
    transactionId: status === 'paid' || status === 'returned' ? 'TXN-1' : null,
    providerStatus: status.toUpperCase(),
  };
}

describe('money and deterministic routing', () => {
  it('parses decimal money without floating point rounding', () => {
    expect(parseMoney('23.80')).toBe(2380);
    expect(parseMoney('0.01')).toBe(1);
    expect(parseMoney('1000000.00')).toBe(100_000_000);
    for (const invalid of ['1.001', '-1', '1e3', 'NaN', '0', '1,000', ' 1', '1000000.01'])
      expect(() => parseMoney(invalid)).toThrow();
  });
  it('keeps automatic payments off until finance explicitly enables them', async () => {
    const c = await ready();
    const submitted = await service.submit('alex', c.id, c.version);
    expect(submitted.reviewStatus).toBe('needs_review');
    expect(submitted.approval).toBeNull();
    expect(submitted.findings.some((f) => f.code === 'auto_disabled')).toBe(true);
    await expect(policy()).resolves.toMatchObject({ autoPaymentEnabled: true });
    expect((await service.getClaim('alex', c.id)).reviewStatus).toBe('needs_review');
  });
  it('uses inclusive £50 and £200 boundaries, with one penny over going to finance', async () => {
    await policy();
    const prior = await ready(15000);
    await service.submit('alex', prior.id, prior.version);
    await service.review('morgan', prior.id, prior.version, {
      decision: 'approve',
      reason: 'Approved the documented larger expense.',
    });
    const exact = await ready(5000);
    const result = await service.submit('alex', exact.id, exact.version);
    expect(result.reviewStatus).toBe('approved');
    expect(result.approval?.kind).toBe('auto');
    const over = await ready(5001);
    const overResult = await service.submit('alex', over.id, over.version);
    expect(overResult.reviewStatus).toBe('needs_review');
    expect(overResult.findings.filter((f) => f.outcome === 'manual').map((f) => f.code)).toEqual(
      expect.arrayContaining(['single_limit', 'monthly_limit']),
    );
  });
  it('does not allow concurrent approvals to exceed the monthly allowance', async () => {
    await policy(true, { monthlyLimitMinor: 7000 });
    const a = await ready(4000);
    const b = await ready(4000);
    const results = await Promise.all([
      service.submit('alex', a.id, a.version),
      service.submit('alex', b.id, b.version),
    ]);
    expect(results.map((c) => c.reviewStatus).sort()).toEqual(['approved', 'needs_review']);
  });
  it('commits the automatic approval and recoverable payment intent in one transaction', async () => {
    await policy();
    const c = await ready();
    const submitted = await service.submit('alex', c.id, c.version);
    expect(submitted).toMatchObject({ reviewStatus: 'approved', paymentStatus: 'queued' });
    const jobs = await service.listRecoverablePayments();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].id).toBe(submitted.paymentIntentId);
    expect((await service.preparePayment('alex', c.id, c.version)).id).toBe(jobs[0].id);
  });
  it('keeps a large-expense review condition after a blurry receipt is corrected', async () => {
    await policy();
    let c = await ready(42000);
    c = await service.saveExtraction(
      'alex',
      c.id,
      c.version,
      extraction(c, { totalMinor: null, issues: ['Total is blurred.'] }),
    );
    c = await service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_info');
    expect(c.findings.some((f) => f.code === 'single_limit')).toBe(true);
    c = await service.removeAttachment('alex', c.id, c.version, c.attachments[0].id);
    c = await service.addAttachment('alex', c.id, c.version, {
      name: 'clear.pdf',
      mediaType: 'application/pdf',
      pages: 1,
      size: 1000,
      sha256: 'f'.repeat(64),
      storageKey: 'northstar/alex/clear.pdf',
    });
    c = await service.saveExtraction('alex', c.id, c.version, extraction(c));
    c = await service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.versions).toHaveLength(2);
  });
  it('does not replace missing receipt evidence with applicant-entered fields', async () => {
    await policy();
    let c = await ready();
    c = await service.saveExtraction(
      'alex',
      c.id,
      c.version,
      extraction(c, { totalMinor: null, date: null }),
    );
    c = await service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_info');
    expect(c.approval).toBeNull();
    await expect(
      service.review('morgan', c.id, c.version, {
        decision: 'approve',
        reason: 'Trying to bypass missing fields.',
      }),
    ).rejects.toMatchObject({ code: 'approval_blocked' });
  });
  it('rejects an unpayable amount and recipient length before creating any payment intent', async () => {
    await expect(service.createDraft('alex', { amountMinor: 100_000_001 })).rejects.toBeTruthy();
    const longEmail = `${'a'.repeat(63)}@${'b'.repeat(60)}.test`;
    await expect(
      service.updateProfile('alex', { email: longEmail, confirmed: true }),
    ).rejects.toBeTruthy();
    expect(await service.listRecoverablePayments()).toHaveLength(0);
  });
  it('requires receipt category evidence and sends misclassified meals to finance', async () => {
    await policy();
    let c = await ready(2380, { category: 'transport' });
    c = await service.saveExtraction('alex', c.id, c.version, extraction(c, { category: 'meals' }));
    c = await service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.findings.some((f) => f.code === 'category_mismatch')).toBe(true);
    let unknown = await ready();
    unknown = await service.saveExtraction(
      'alex',
      unknown.id,
      unknown.version,
      extraction(unknown, { category: null }),
    );
    unknown = await service.updateDraft('alex', unknown.id, unknown.version, {
      fieldsConfirmed: true,
    });
    expect((await service.submit('alex', unknown.id, unknown.version)).reviewStatus).toBe(
      'needs_review',
    );
  });
  it('requires an explanation and human approval for partial reimbursement', async () => {
    await policy();
    let c = await ready(3000);
    c = await service.saveExtraction('alex', c.id, c.version, extraction(c, { totalMinor: 4500 }));
    c = await service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_info');
    c = await service.updateDraft('alex', c.id, c.version, {
      partialExplanation: 'Only the business train ticket is claimed.',
      fieldsConfirmed: true,
    });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.amountMinor).toBe(3000);
  });
  it('accepts 30 calendar days and preserves first-submission month after later corrections', async () => {
    await policy();
    let c = await ready(2380, { date: '2026-09-30' });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('approved');
    const originalDate = c.firstSubmittedAt;
    now = '2026-11-01T01:00:00.000Z';
    c = await service.updateDraft('alex', c.id, c.version, {
      partialExplanation: 'Additional detail',
      fieldsConfirmed: true,
    });
    c = await service.submit('alex', c.id, c.version);
    expect(c.submissionMonth).toBe('2026-10');
    expect(c.firstSubmittedAt).toBe(originalDate);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.findings.some((f) => f.code === 'cross_month')).toBe(true);
  });
});

describe('authorization and immutable versions', () => {
  it('denies another member access, exports and receipt reads; client roles are rejected', async () => {
    const c = await ready();
    await expect(service.getClaim('sam', c.id)).rejects.toMatchObject({ status: 404 });
    await expect(service.getAttachment('sam', c.attachments[0].id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.updateDraft('sam', c.id, c.version, { merchant: 'Wrong' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updatePolicy('alex', 1, {
        autoPaymentEnabled: true,
        autoCategories: ['transport'],
        singleLimitMinor: 999999,
        monthlyLimitMinor: 999999,
        maxAgeDays: 30,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.createDraft('morgan')).rejects.toMatchObject({ status: 403 });
    await expect(service.createDraft('alex', { role: 'reviewer' } as never)).rejects.toBeTruthy();
    expect(await service.exportClaims('sam')).not.toContain(c.id);
    const foreign = createDemoState(now, false);
    foreign.organization.id = 'other';
    foreign.policy.organizationId = 'other';
    foreign.members = [
      {
        id: 'outside',
        organizationId: 'other',
        name: 'Outside',
        email: 'outside@example.test',
        role: 'reviewer',
      },
    ];
    foreign.policyHistory = [foreign.policy];
    await db.seed(foreign);
    await expect(service.getClaim('outside', c.id)).rejects.toMatchObject({ status: 404 });
  });
  it('rejects stale edits and binds approval to the confirmed claim and recipient version', async () => {
    const c = await approvedManual();
    await expect(
      service.updateDraft('alex', c.id, c.version - 1, { merchant: 'Other' }),
    ).rejects.toMatchObject({ code: 'version_conflict' });
    const changed = await service.updateDraft('alex', c.id, c.version, { amountMinor: 3000 });
    expect(changed.approval?.invalidatedAt).not.toBeNull();
    await expect(service.preparePayment('morgan', c.id, changed.version)).rejects.toMatchObject({
      code: 'approval_stale',
    });
    expect(changed.versions[0].snapshot.amountMinor).toBe(2380);
    expect(changed.approvalHistory).toHaveLength(1);
    expect(changed.approvalHistory[0]).toMatchObject({
      amountMinor: 2380,
      claimVersion: c.version,
      profileVersion: 1,
      invalidatedAt: null,
    });
  });
  it('invalidates unsent approval when the confirmed recipient changes', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.updateProfile('alex', { email: 'new@example.test', confirmed: true });
    expect((await service.getClaim('alex', c.id)).reviewStatus).toBe('draft');
    expect(await service.acquirePayment(p.id)).toBeNull();
  });
  it('retains an explicit manual approval when only the automatic-payment switch changes', async () => {
    const c = await approvedManual();
    await policy(true);
    expect((await service.getClaim('morgan', c.id)).reviewStatus).toBe('approved');
    await expect(service.preparePayment('morgan', c.id, c.version)).resolves.toMatchObject({
      status: 'queued',
    });
  });
  it('does not silently remove earlier manual concerns after policy is relaxed', async () => {
    await policy();
    let c = await ready(6000);
    c = await service.submit('alex', c.id, c.version);
    await policy(true, { singleLimitMinor: 10000 });
    c = await service.submit('alex', c.id, c.version);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.findings.some((f) => f.code === 'prior_manual_review')).toBe(true);
  });
  it.each(['reject', 'request_info'] as const)(
    'retains a finance %s through repeated submission, corrections and enabling automatic payment',
    async (decision) => {
      let c = await ready();
      c = await service.submit('alex', c.id, c.version);
      c = await service.review('morgan', c.id, c.version, {
        decision,
        reason: 'Finance needs an updated business justification.',
      });
      await policy(true);
      const repeat = await service.submit('alex', c.id, c.version);
      expect(repeat.reviewStatus).toBe(decision === 'reject' ? 'rejected' : 'needs_info');
      expect(repeat.approval).toBeNull();
      expect(repeat.paymentIntentId).toBeNull();
      // Re-extraction resets the displayed review status, but cannot clear finance's hold.
      c = await service.saveExtraction('alex', c.id, c.version, extraction(c));
      c = await service.updateDraft('alex', c.id, c.version, {
        partialExplanation: 'Added the requested business justification.',
        fieldsConfirmed: true,
      });
      c = await service.submit('alex', c.id, c.version);
      expect(c.reviewStatus).toBe('needs_review');
      expect(c.approval).toBeNull();
      expect(c.paymentIntentId).toBeNull();
      c = await service.review('morgan', c.id, c.version, {
        decision: 'approve',
        reason: 'Checked the updated justification and explicitly resolved the earlier decision.',
      });
      expect(c.approval?.kind).toBe('manual');
      await expect(service.preparePayment('morgan', c.id, c.version)).resolves.toMatchObject({
        status: 'queued',
      });
    },
  );
  it('requires a fresh manual decision when the monthly limit becomes a new concern before sending', async () => {
    await policy(false, { monthlyLimitMinor: 5000 });
    const first = await approvedManual(3000);
    await approvedManual(3000);
    await expect(service.preparePayment('morgan', first.id, first.version)).rejects.toMatchObject({
      code: 'payment_blocked',
    });
    const fresh = await service.review('morgan', first.id, first.version, {
      decision: 'approve',
      reason:
        'Reviewed the newly exceeded monthly allowance and approved the documented exception.',
    });
    expect(fresh.approval?.id).not.toBe(first.approval?.id);
    expect(fresh.approval?.reviewedFindingCodes).toContain('monthly_limit');
    await expect(service.preparePayment('morgan', first.id, first.version)).resolves.toMatchObject({
      status: 'queued',
    });
  });
  it('treats same merchant/date/amount as a suspected duplicate, with exact paid originals blocked', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(p.id);
    await service.recordPaymentResult(p.id, verified(p));
    let similar = await ready(2380, { merchant: c.merchant, date: c.date });
    similar = await service.submit('alex', similar.id, similar.version);
    expect(similar.findings.find((f) => f.code === 'possible_duplicate')?.outcome).toBe('manual');
    expect(similar.findings.some((f) => f.code === 'already_paid')).toBe(false);
    let exact = await ready(2380, { merchant: 'A changed label' }, c.attachments[0].sha256);
    exact = await service.submit('alex', exact.id, exact.version);
    expect(exact.findings.find((f) => f.code === 'already_paid')?.outcome).toBe('block');
  });
});

describe('durable payment intents and reconciliation', () => {
  it('reuses one intent and lease under duplicate clicks, and does not confuse acceptance with paid', async () => {
    const c = await approvedManual();
    const [a, b] = await Promise.all([
      service.preparePayment('morgan', c.id, c.version),
      service.preparePayment('morgan', c.id, c.version),
    ]);
    expect(a.id).toBe(b.id);
    const [first, second] = await Promise.all([
      service.acquirePayment(a.id),
      service.acquirePayment(a.id),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    await service.recordPaymentSubmission(a.id, {
      status: 'processing',
      providerBatchId: 'BATCH-1',
      providerStatus: 'PENDING',
    });
    expect((await service.getClaim('alex', c.id)).paymentStatus).toBe('processing');
    await service.recordPaymentResult(a.id, verified(a));
    expect((await service.getClaim('alex', c.id)).paymentStatus).toBe('paid');
    expect((await service.preparePayment('morgan', c.id, c.version)).id).toBe(a.id);
  });
  it('recovers a crashed dispatch by querying the original identity and preserves the allowance', async () => {
    await policy(true, { monthlyLimitMinor: 4000 });
    const c = await ready(4000);
    await service.submit('alex', c.id, c.version);
    const p = await service.preparePayment('alex', c.id, c.version);
    await service.acquirePayment(p.id);
    now = '2026-10-30T12:02:00.000Z';
    const recovered = await service.acquirePayment(p.id);
    expect(recovered?.action).toBe('query');
    expect(recovered?.intent.senderBatchId).toBe(p.senderBatchId);
    await service.recordPaymentUnknown(p.id);
    const another = await ready(100);
    expect((await service.submit('alex', another.id, another.version)).reviewStatus).toBe(
      'needs_review',
    );
    await expect(
      service.updateDraft('alex', c.id, c.version, { amountMinor: 10 }),
    ).rejects.toMatchObject({ code: 'payment_locked' });
  });
  it('rejects wrong amount, recipient and identifiers before applying any provider success', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(p.id);
    for (const patch of [
      { amountMinor: 1 },
      { recipientEmail: 'attacker@example.test' },
      { senderItemId: 'OTHER' },
      { currency: 'USD' },
      { transactionId: null },
    ])
      await expect(
        service.recordPaymentResult(p.id, { ...verified(p), ...patch }),
      ).rejects.toBeTruthy();
    expect((await service.getClaim('alex', c.id)).paymentStatus).toBe('processing');
  });
  it('keeps paid status against late pending events and records a verified later return', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(p.id);
    await service.recordPaymentResult(p.id, verified(p));
    await service.recordPaymentResult(p.id, verified(p, 'processing'));
    expect((await service.getClaim('alex', c.id)).paymentStatus).toBe('paid');
    await service.recordPaymentResult(p.id, verified(p, 'returned'));
    expect((await service.getClaim('alex', c.id)).paymentStatus).toBe('returned');
    expect(await service.acquirePayment(p.id)).toBeNull();
  });
  it('deduplicates webhook identifiers transactionally and only permits verified item reconciliation', async () => {
    const result = await Promise.all([
      service.claimWebhookEvent('northstar', 'WH-1'),
      service.claimWebhookEvent('northstar', 'WH-1'),
    ]);
    expect(result.sort()).toEqual([false, true]);
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await expect(service.recordPaymentResult(p.id, verified(p))).rejects.toMatchObject({
      code: 'payment_not_started',
    });
  });
  it('requires finance to reopen a verified failure, then applicant confirmation and a fresh manual approval', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(p.id);
    await service.recordPaymentResult(p.id, verified(p, 'failed'));
    await expect(service.preparePayment('morgan', c.id, c.version)).rejects.toMatchObject({
      code: 'recovery_required',
    });
    await expect(
      service.updateDraft('alex', c.id, c.version, { fieldsConfirmed: true }),
    ).rejects.toMatchObject({ code: 'payment_locked' });
    await expect(
      service.reopenAfterFailedPayment('alex', c.id, c.version, 'Please reopen'),
    ).rejects.toMatchObject({ status: 403 });
    let reopened = await service.reopenAfterFailedPayment(
      'morgan',
      c.id,
      c.version,
      'Verified the failed payout; applicant should correct and reconfirm the recipient.',
    );
    expect(reopened.version).toBe(c.version + 1);
    expect(reopened.fieldsConfirmed).toBe(false);
    expect(reopened.paymentHistory).toHaveLength(1);
    reopened = await service.updateDraft('alex', c.id, reopened.version, { fieldsConfirmed: true });
    reopened = await service.submit('alex', c.id, reopened.version);
    expect(reopened.reviewStatus).toBe('needs_review');
    reopened = await service.review('morgan', c.id, reopened.version, {
      decision: 'approve',
      reason: 'Rechecked the failed original and confirmed correction version.',
    });
    const retry = await service.preparePayment('morgan', c.id, reopened.version);
    expect(retry.id).not.toBe(p.id);
    expect(retry.senderBatchId).not.toBe(p.senderBatchId);
    expect((await service.getClaim('alex', c.id)).paymentHistory).toHaveLength(2);
  });
  it('allows finance to approve and replace a queued payment cancelled before sending', async () => {
    await policy(true);
    let c = await ready();
    c = await service.submit('alex', c.id, c.version);
    const original = c.payment!;
    now = '2026-11-01T01:00:00.000Z';
    expect(await service.acquirePayment(original.id)).toBeNull();
    c = await service.getClaim('morgan', c.id);
    expect(c.reviewStatus).toBe('needs_review');
    expect(c.paymentStatus).toBe('cancelled');
    expect(c.payment?.sentAt).toBeNull();
    expect(c.findings.some((f) => f.code === 'cross_month')).toBe(true);
    c = await service.review('morgan', c.id, c.version, {
      decision: 'approve',
      reason: 'Reviewed the original submission month and authorized sending in November.',
    });
    expect(c.reviewStatus).toBe('approved');
    const replacement = await service.preparePayment('morgan', c.id, c.version);
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.status).toBe('queued');
    await expect(service.acquirePayment(replacement.id)).resolves.toMatchObject({ action: 'send' });
    expect((await service.getClaim('alex', c.id)).paymentHistory).toHaveLength(2);
  });
  it('retains the current payment and allowance when an older failed attempt is reconciled again', async () => {
    await policy(false, { monthlyLimitMinor: 4000 });
    const c = await approvedManual(4000);
    const first = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(first.id);
    await service.recordPaymentResult(first.id, verified(first, 'failed'));
    let reopened = await service.reopenAfterFailedPayment(
      'morgan',
      c.id,
      c.version,
      'Verified the first attempt failed; approve a corrected version.',
    );
    reopened = await service.updateDraft('alex', c.id, reopened.version, { fieldsConfirmed: true });
    reopened = await service.submit('alex', c.id, reopened.version);
    reopened = await service.review('morgan', c.id, reopened.version, {
      decision: 'approve',
      reason: 'Approved the corrected version after checking the failed payment.',
    });
    const current = await service.preparePayment('morgan', c.id, reopened.version);
    await service.acquirePayment(current.id);
    now = '2026-10-30T12:01:00.000Z';
    await service.recordPaymentResult(first.id, verified(first, 'failed'));
    const latest = await service.getClaim('alex', c.id);
    expect(latest.paymentIntentId).toBe(current.id);
    expect(latest.paymentStatus).toBe('processing');
    expect(latest.payment?.status).toBe('processing');
    expect(latest.paymentHistory.find((p) => p.id === first.id)?.lastReconciledAt).toBe(now);
    await policy(true);
    const another = await ready(100);
    const submitted = await service.submit('alex', another.id, another.version);
    expect(submitted.reviewStatus).toBe('needs_review');
    expect(submitted.findings.some((f) => f.code === 'monthly_limit')).toBe(true);
    expect(submitted.approval).toBeNull();
  });
  it('never permits reopening an unknown, unclaimed, paid or returned payment', async () => {
    const c = await approvedManual();
    const p = await service.preparePayment('morgan', c.id, c.version);
    await service.acquirePayment(p.id);
    for (const status of ['unknown', 'unclaimed', 'paid', 'returned'] as const) {
      await service.recordPaymentResult(p.id, verified(p, status));
      await expect(
        service.reopenAfterFailedPayment('morgan', c.id, c.version, 'Attempting a correction'),
      ).rejects.toMatchObject({ code: 'recovery_not_allowed' });
    }
  });
});

describe('receipt tasks and exports', () => {
  it('deduplicates extraction and ignores asynchronous output for superseded versions', async () => {
    let c = await ready();
    const [a, b] = await Promise.all([
      service.startExtraction('alex', c.id, c.version),
      service.startExtraction('alex', c.id, c.version),
    ]);
    expect([a, b].filter((j) => j.shouldRun)).toHaveLength(1);
    expect(a.jobId).toBe(b.jobId);
    const old = c;
    c = await service.updateDraft('alex', c.id, c.version, { merchant: 'Changed merchant' });
    const result = await service.saveExtraction(
      'alex',
      old.id,
      old.version,
      extraction(old),
      a.jobId,
    );
    expect(result.version).toBe(c.version);
    expect(result.merchant).toBe('Changed merchant');
    expect(result.timeline.some((e) => e.type === 'stale_extraction')).toBe(true);
  });
  it('ignores an expired extraction attempt after a recovery attempt acquired a new lease', async () => {
    const c = await ready();
    const first = await service.startExtraction('alex', c.id, c.version);
    now = '2026-10-30T12:03:00.000Z';
    const second = await service.startExtraction('alex', c.id, c.version);
    expect(second.shouldRun).toBe(true);
    expect(second.jobId).not.toBe(first.jobId);
    await service.saveExtraction(
      'alex',
      c.id,
      c.version,
      extraction(c, { merchant: 'Expired result' }),
      first.jobId,
    );
    const current = await service.saveExtraction(
      'alex',
      c.id,
      c.version,
      extraction(c),
      second.jobId,
    );
    expect(current.extraction?.merchant).toBe(c.merchant);
    expect(current.timeline.some((e) => e.type === 'stale_extraction')).toBe(true);
  });
  it('retains an older extraction job result when its attachment was removed meanwhile', async () => {
    const c = await ready();
    const job = await service.startExtraction('alex', c.id, c.version);
    const changed = await service.removeAttachment('alex', c.id, c.version, c.attachments[0].id);
    const completed = await service.saveExtraction(
      'alex',
      c.id,
      c.version,
      extraction(c),
      job.jobId,
    );
    expect(completed.version).toBe(changed.version);
    expect(completed.extraction).toBeNull();
    expect(completed.timeline.some((e) => e.type === 'stale_extraction')).toBe(true);
    const persisted = await db.transaction(
      'northstar',
      (s) => s.extractionJobs.find((j) => j.claimId === c.id)?.result,
    );
    expect(persisted?.merchant).toBe(c.merchant);
  });
  it('preserves originals when a current attachment is removed and prevents CSV formula execution', async () => {
    let c = await ready(2380, { merchant: '=HYPERLINK("https://example.test")' });
    c = await service.submit('alex', c.id, c.version);
    c = await service.removeAttachment('alex', c.id, c.version, c.attachments[0].id);
    expect(c.attachments).toHaveLength(0);
    expect(c.versions[0].snapshot.attachmentIds).toHaveLength(1);
    const csv = await service.exportClaims('alex');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toContain('storageKey');
  });
});
