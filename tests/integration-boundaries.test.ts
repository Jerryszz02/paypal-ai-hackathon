import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDatabase, type Database } from '../src/lib/db/database';
import { createDemoState } from '../src/lib/db/demo';
import { ReimbursementService } from '../src/lib/domain/service';
import type { ClaimDetail, PaymentIntent } from '../src/lib/types';

const mocks = vi.hoisted(() => ({
  service: null as unknown,
  sessionUserId: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('@/lib/server/application', () => ({ getApplication: async () => mocks.service }));
vi.mock('@/lib/server/auth', () => ({
  sessionUserId: mocks.sessionUserId,
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));

import { GET, PATCH, POST, PUT } from '../src/app/api/[...path]/route';
import { HttpError } from '../src/lib/server/config';

let db: Database;
let service: ReimbursementService;
let dataDir: string;
beforeEach(async () => {
  vi.stubEnv('APP_MODE', 'demo');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('NETLIFY', '');
  dataDir = await mkdtemp(path.join(tmpdir(), 'carry-integration-test-'));
  vi.stubEnv('LOCAL_DATA_DIR', dataDir);
  db = await createDatabase();
  await db.seed(createDemoState(new Date().toISOString(), false));
  service = new ReimbursementService(db, { mode: 'demo' });
  mocks.service = service;
  mocks.sessionUserId.mockReset().mockResolvedValue('alex');
});
afterEach(async () => {
  await db.close();
  await rm(dataDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

function call(
  route: string,
  method = 'GET',
  body?: unknown,
  origin: string | null = 'http://127.0.0.1:3107',
) {
  const headers = new Headers();
  if (origin !== null) headers.set('origin', origin);
  if (body !== undefined) headers.set('content-type', 'application/json');
  const request = new Request(`http://127.0.0.1:3107/api/${route}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const handler =
    method === 'GET' ? GET : method === 'PUT' ? PUT : method === 'PATCH' ? PATCH : POST;
  return handler(request, { params: Promise.resolve({ path: route.split('/') }) });
}

describe('HTTP application and service integration boundaries', () => {
  it('rejects missing/foreign mutation origins before executing business actions', async () => {
    expect((await call('claims', 'POST', {}, null)).status).toBe(403);
    expect((await call('claims', 'POST', {}, 'https://attacker.test')).status).toBe(403);
    expect((await service.bootstrap('alex')).claims).toHaveLength(0);
    expect(mocks.sessionUserId).not.toHaveBeenCalled();
  });

  it('uses the verified session subject and refuses injected owner/role/payment fields', async () => {
    const injected = await call('claims', 'POST', {
      ownerId: 'morgan',
      role: 'reviewer',
      paymentStatus: 'paid',
    });
    expect(injected.status).toBe(400);
    const response = await call('claims', 'POST', {
      merchant: 'My merchant',
      purpose: 'Workshop travel',
    });
    expect(response.status).toBe(201);
    const claim = (await response.json()) as ClaimDetail;
    expect(claim).toMatchObject({
      ownerId: 'alex',
      paymentStatus: 'not_started',
      reviewStatus: 'draft',
    });
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('keeps claim details and exports scoped to the applicant while allowing trusted finance review', async () => {
    const claim = await service.createDraft('alex', { merchant: 'Private merchant' });
    mocks.sessionUserId.mockResolvedValue('sam');
    expect((await call(`claims/${claim.id}`)).status).toBe(404);
    const exported = await call('export');
    expect(await exported.text()).not.toContain(claim.id);
    mocks.sessionUserId.mockResolvedValue('morgan');
    expect((await call(`claims/${claim.id}`)).status).toBe(200);
    mocks.sessionUserId.mockResolvedValue('alex');
    const policy = (await service.bootstrap('alex')).policy;
    const input = {
      autoPaymentEnabled: true,
      autoCategories: policy.autoCategories,
      singleLimitMinor: policy.singleLimitMinor,
      monthlyLimitMinor: policy.monthlyLimitMinor,
      maxAgeDays: policy.maxAgeDays,
    };
    expect(
      (await call('policy', 'PUT', { ...input, expectedVersion: policy.version })).status,
    ).toBe(403);
  });

  it('authorizes private original receipt reads through the service before reading file bytes', async () => {
    const draft = await service.createDraft('alex');
    const response = await call(`claims/${draft.id}/sample`, 'POST', {
      expectedVersion: draft.version,
      sample: 'clear',
    });
    expect(response.status).toBe(200);
    const claim = (await response.json()) as ClaimDetail;
    expect(claim.attachments).toHaveLength(1);
    const attachmentId = claim.attachments[0].id;
    mocks.sessionUserId.mockResolvedValue('sam');
    expect((await call(`attachments/${attachmentId}`)).status).toBe(404);
    mocks.sessionUserId.mockResolvedValue('alex');
    const preview = await call(`attachments/${attachmentId}`);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('content-type')).toBe('application/pdf');
    expect(preview.headers.get('content-security-policy')).toContain('sandbox');
    expect(preview.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('protects machine recovery and leaves local demo webhooks disabled', async () => {
    expect((await call('worker', 'POST', {}, null)).status).toBe(401);
    expect(
      (
        await call(
          'webhooks/paypal',
          'POST',
          { id: 'forged', resource: { transaction_status: 'SUCCESS' } },
          null,
        )
      ).status,
    ).toBe(404);
    mocks.sessionUserId.mockRejectedValue(
      new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.'),
    );
    expect((await call('bootstrap')).status).toBe(401);
  });

  it('does not reuse a synthetic purpose verdict after editing and re-extracting the same receipt', async () => {
    await service.updateProfile('alex', {
      email: 'alex-paypal@example.test',
      confirmed: true,
      expectedVersion: 0,
    });
    const policy = (await service.bootstrap('morgan')).policy;
    await service.updatePolicy('morgan', policy.version, {
      autoPaymentEnabled: true,
      autoCategories: policy.autoCategories,
      singleLimitMinor: policy.singleLimitMinor,
      monthlyLimitMinor: policy.monthlyLimitMinor,
      maxAgeDays: policy.maxAgeDays,
    });
    const draft = await service.createDraft('alex');
    let response = await call(`claims/${draft.id}/sample`, 'POST', {
      expectedVersion: draft.version,
      sample: 'clear',
    });
    let claim = (await response.json()) as ClaimDetail;
    expect(claim.extraction?.purposeMatches).toBe(true);
    response = await call(`claims/${claim.id}`, 'PATCH', {
      expectedVersion: claim.version,
      purpose: 'Personal weekend trip unrelated to work',
    });
    claim = (await response.json()) as ClaimDetail;
    expect(claim.extraction).toBeNull();
    response = await call(`claims/${claim.id}/extract`, 'POST', { expectedVersion: claim.version });
    claim = (await response.json()) as ClaimDetail;
    expect(claim.extraction?.purposeMatches).toBeNull();
    response = await call(`claims/${claim.id}`, 'PATCH', {
      expectedVersion: claim.version,
      fieldsConfirmed: true,
      paidConfirmed: true,
    });
    claim = (await response.json()) as ClaimDetail;
    response = await call(`claims/${claim.id}/submit`, 'POST', { expectedVersion: claim.version });
    claim = (await response.json()) as ClaimDetail;
    expect(claim.reviewStatus).toBe('needs_review');
    expect(
      claim.findings.some(
        (finding) => finding.code === 'purpose_match' && finding.outcome === 'manual',
      ),
    ).toBe(true);
    expect(claim.paymentIntentId).toBeNull();
  });

  it('recovers the oldest due intent even behind ten long-lived unclaimed intents', async () => {
    const drafts: ClaimDetail[] = [];
    for (let i = 0; i < 11; i++) drafts.push(await service.createDraft('alex'));
    const now = new Date().toISOString();
    const oldest = new Date(Date.now() - 86400000).toISOString();
    await db.transaction('northstar', (state) => {
      for (let i = 0; i < drafts.length; i++) {
        const id = `recovery-${String(i).padStart(2, '0')}`;
        const claim = state.claims.find((candidate) => candidate.id === drafts[i].id)!;
        const payment: PaymentIntent = {
          id,
          organizationId: 'northstar',
          claimId: claim.id,
          claimVersion: claim.version,
          approvalId: `approval-${i}`,
          ownerId: 'alex',
          profileVersion: 1,
          policyVersion: 1,
          amountMinor: 100,
          currency: 'GBP',
          recipientEmail: 'alex-paypal@example.test',
          senderBatchId: `batch-${i}`,
          senderItemId: `item-${i}`,
          fingerprint: `fingerprint-${i}`,
          mode: 'demo',
          status: 'unclaimed',
          providerBatchId: `demo-${id}`,
          providerItemId: null,
          transactionId: null,
          providerStatus: 'DEMO_UNCLAIMED',
          createdAt: oldest,
          updatedAt: i === 10 ? oldest : now,
          sentAt: oldest,
          leaseUntil: null,
          lastReconciledAt: null,
          failureCode: null,
        };
        state.payments.push(payment);
        claim.paymentIntentId = id;
        claim.paymentStatus = 'unclaimed';
      }
    });
    vi.stubEnv('WORKER_SECRET', 'test-worker-secret-of-at-least-32-characters');
    const request = new Request('http://127.0.0.1:3107/api/worker', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.WORKER_SECRET}` },
    });
    const response = await POST(request, { params: Promise.resolve({ path: ['worker'] }) });
    expect(response.status).toBe(200);
    expect((await service.getClaim('alex', drafts[10].id)).paymentStatus).toBe('paid');
    expect((await service.listRecoverablePayments()).length).toBe(8);
  });
});
