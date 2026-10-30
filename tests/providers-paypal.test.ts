import { describe, expect, it, vi } from 'vitest';
import {
  DemoPayoutProvider,
  PayPalSandboxProvider,
  mapPayPalItemStatus,
  payoutAmount,
  validatePayPalItem,
} from '../src/lib/providers/paypal';
import type { PaymentIntent } from '../src/lib/types';

const now = Date.parse('2026-10-29T10:00:00Z');
function intent(patch: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: 'intent-1',
    organizationId: 'org-1',
    claimId: 'claim-1',
    claimVersion: 1,
    approvalId: 'approval-1',
    ownerId: 'member-1',
    profileVersion: 1,
    policyVersion: 1,
    amountMinor: 2380,
    currency: 'GBP',
    recipientEmail: 'recipient@example.test',
    senderBatchId: 'stable-batch',
    senderItemId: 'stable-item',
    fingerprint: 'frozen-fingerprint',
    status: 'queued',
    mode: 'sandbox',
    providerBatchId: null,
    providerItemId: null,
    transactionId: null,
    providerStatus: null,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    sentAt: null,
    leaseUntil: null,
    lastReconciledAt: null,
    failureCode: null,
    ...patch,
  };
}
function item(status = 'SUCCESS', patch: Record<string, unknown> = {}) {
  return {
    payout_batch_id: 'provider-batch',
    payout_item_id: 'provider-item',
    sender_batch_id: 'stable-batch',
    transaction_status: status,
    transaction_id: 'transaction-1',
    payout_item: {
      sender_item_id: 'stable-item',
      recipient_type: 'EMAIL',
      receiver: 'recipient@example.test',
      amount: { currency: 'GBP', value: '23.80' },
    },
    ...patch,
  };
}
function fakeFetch(...responses: (Record<string, unknown> | Error)[]) {
  const fetcher = vi.fn<typeof fetch>();
  for (const response of responses) {
    if (response instanceof Error) fetcher.mockRejectedValueOnce(response);
    else fetcher.mockResolvedValueOnce(Response.json(response));
  }
  return fetcher;
}
const oauth = { access_token: 'test-access-token', expires_in: 3600 };
const accepted = {
  batch_header: {
    payout_batch_id: 'provider-batch',
    batch_status: 'SUCCESS',
    sender_batch_header: { sender_batch_id: 'stable-batch' },
  },
};
const batch = { ...accepted, total_items: 1, items: [item()] };

describe('PayPal Sandbox adapter', () => {
  it('formats integer minor units without floating-point amount calculations', () => {
    expect(payoutAmount(2380)).toBe('23.80');
    expect(payoutAmount(1)).toBe('0.01');
    expect(() => payoutAmount(23.8)).toThrow();
    expect(() => payoutAmount(0)).toThrow();
  });

  it('uses only Sandbox URLs and stable request/batch/item IDs across retries', async () => {
    const fetcher = fakeFetch(oauth, accepted, accepted);
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(await provider.createPayout(intent())).toEqual({
      status: 'processing',
      providerBatchId: 'provider-batch',
      providerStatus: 'SUCCESS',
    });
    await provider.createPayout(intent());
    expect(fetcher).toHaveBeenCalledTimes(3); // OAuth token reused.
    const first = fetcher.mock.calls[1];
    const second = fetcher.mock.calls[2];
    expect(first[0]).toBe('https://api-m.sandbox.paypal.com/v1/payments/payouts');
    expect(first[1]?.headers).toMatchObject({ 'PayPal-Request-Id': 'intent-1' });
    expect(first[1]?.body).toBe(second[1]?.body);
    expect(JSON.parse(String(first[1]?.body))).toMatchObject({
      sender_batch_header: { sender_batch_id: 'stable-batch' },
      items: [
        {
          sender_item_id: 'stable-item',
          receiver: 'recipient@example.test',
          amount: { currency: 'GBP', value: '23.80' },
        },
      ],
    });
    expect(JSON.stringify(first[1]?.body)).not.toContain('test-secret');
  });

  it('keeps a timed-out request unknown and never invents a batch identifier', async () => {
    const fetcher = fakeFetch(oauth, new Error('timeout'));
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(await provider.createPayout(intent())).toMatchObject({
      status: 'unknown',
      providerBatchId: null,
      failureCode: 'PAYPAL_REQUEST_UNCERTAIN',
    });
  });

  it('retains an accepted batch identifier even when the response omits its optional sender echo', async () => {
    const fetcher = fakeFetch(oauth, {
      batch_header: {
        payout_batch_id: 'provider-batch',
        batch_status: 'PENDING',
        sender_batch_header: {},
      },
    });
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(await provider.createPayout(intent())).toEqual({
      status: 'processing',
      providerBatchId: 'provider-batch',
      providerStatus: 'PENDING',
    });
  });

  it('does not resend after the provider deduplication window or for a known batch', async () => {
    const fetcher = fakeFetch();
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(
      await provider.createPayout(
        intent({ createdAt: new Date(now - 30 * 86400000).toISOString() }),
      ),
    ).toMatchObject({ status: 'unknown', failureCode: 'RETRY_WINDOW_EXPIRED' });
    expect(await provider.createPayout(intent({ providerBatchId: 'known-batch' }))).toMatchObject({
      status: 'processing',
      providerBatchId: 'known-batch',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('recovers a duplicate only from a validated Sandbox link and then reconciles the actual item', async () => {
    const fetcher = fakeFetch(oauth);
    fetcher.mockResolvedValueOnce(
      Response.json(
        {
          name: 'DUPLICATE_BATCH_ID',
          links: [
            {
              href: 'https://api-m.sandbox.paypal.com/v1/payments/payouts/provider-batch',
              rel: 'self',
            },
          ],
        },
        { status: 400 },
      ),
    );
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(await provider.createPayout(intent())).toEqual({
      status: 'processing',
      providerBatchId: 'provider-batch',
      providerStatus: 'DUPLICATE_RECOVERED',
    });
  });

  it('requires an individual item query even when the batch says SUCCESS', async () => {
    const fetcher = fakeFetch(oauth, batch, item('UNCLAIMED'));
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    const result = await provider.reconcilePayout(intent({ providerBatchId: 'provider-batch' }));
    expect(result.status).toBe('unclaimed');
    expect(fetcher.mock.calls[2][0]).toBe(
      'https://api-m.sandbox.paypal.com/v1/payments/payouts-item/provider-item',
    );
  });

  it('accepts an item without schema-optional sender_batch_id only after verifying its batch header', async () => {
    const response = item();
    const { sender_batch_id: omitted, ...withoutSender } = response;
    expect(omitted).toBe('stable-batch');
    expect(() =>
      validatePayPalItem(intent({ providerBatchId: 'provider-batch' }), withoutSender),
    ).toThrow();
    const fetcher = fakeFetch(oauth, batch, withoutSender);
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    const result = await provider.reconcilePayout(
      intent({ providerBatchId: 'provider-batch', providerItemId: 'provider-item' }),
    );
    expect(result.status).toBe('paid');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain('/v1/payments/payouts/provider-batch?');
  });

  it('still verifies the current batch header for an already-known payout item', async () => {
    const wrongBatch = {
      ...batch,
      batch_header: {
        ...accepted.batch_header,
        sender_batch_header: { sender_batch_id: 'other-batch' },
      },
    };
    const fetcher = fakeFetch(oauth, wrongBatch);
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    await expect(
      provider.reconcilePayout(
        intent({ providerBatchId: 'provider-batch', providerItemId: 'provider-item' }),
      ),
    ).rejects.toThrow('different payout batch');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('accepts schema-minimal item details only with verified unique batch linkage and exact amount/receiver', async () => {
    const minimalItem = {
      payout_batch_id: 'provider-batch',
      payout_item_id: 'provider-item',
      transaction_status: 'SUCCESS',
      transaction_id: 'transaction-1',
      payout_item: {
        receiver: 'recipient@example.test',
        amount: { currency: 'GBP', value: '23.80' },
      },
    };
    const minimalBatch = { ...batch, items: [minimalItem] };
    const fetcher = fakeFetch(oauth, minimalBatch, minimalItem);
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      fetcher,
      now: () => now,
    });
    expect(
      (await provider.reconcilePayout(intent({ providerBatchId: 'provider-batch' }))).status,
    ).toBe('paid');
    expect(() =>
      validatePayPalItem(intent({ providerBatchId: 'provider-batch' }), minimalItem),
    ).toThrow();
  });

  it.each([
    ['SUCCESS', 'paid'],
    ['PENDING', 'processing'],
    ['UNCLAIMED', 'unclaimed'],
    ['FAILED', 'failed'],
    ['DENIED', 'failed'],
    ['RETURNED', 'returned'],
    ['REFUNDED', 'returned'],
    ['CANCELED', 'cancelled'],
    ['ONHOLD', 'unknown'],
    ['BLOCKED', 'unknown'],
  ])('maps single-item %s to %s', (providerStatus, expected) => {
    expect(mapPayPalItemStatus(providerStatus)).toBe(expected);
    expect(
      validatePayPalItem(intent({ providerBatchId: 'provider-batch' }), item(providerStatus))
        .status,
    ).toBe(expected);
  });

  it.each([
    ['batch ID', { payout_batch_id: 'different' }],
    ['sender ID', { sender_batch_id: 'different' }],
    ['recipient', { payout_item: { ...item().payout_item, receiver: 'other@example.test' } }],
    [
      'amount',
      { payout_item: { ...item().payout_item, amount: { currency: 'GBP', value: '23.81' } } },
    ],
    [
      'currency',
      { payout_item: { ...item().payout_item, amount: { currency: 'USD', value: '23.80' } } },
    ],
    ['transaction ID', { transaction_id: undefined }],
  ])('refuses a mismatched %s', (_field, patch) => {
    expect(() =>
      validatePayPalItem(intent({ providerBatchId: 'provider-batch' }), item('SUCCESS', patch)),
    ).toThrow();
  });

  it('rejects missing/malicious webhook headers without making a request', async () => {
    const fetcher = fakeFetch();
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      webhookId: 'webhook-1',
      fetcher,
      now: () => now,
    });
    expect(
      await provider.verifyWebhook(new Headers(), {
        id: 'event-1',
        event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      }),
    ).toBe(false);
    const headers = new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://attacker.test/cert',
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-sig': 'signature',
      'paypal-transmission-time': new Date(now).toISOString(),
    });
    expect(
      await provider.verifyWebhook(headers, {
        id: 'event-1',
        event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
      }),
    ).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('accepts a webhook only after PayPal verifies its signature and configured webhook ID', async () => {
    const fetcher = fakeFetch(
      oauth,
      { verification_status: 'SUCCESS' },
      { verification_status: 'FAILURE' },
    );
    const provider = new PayPalSandboxProvider({
      clientId: 'test-client',
      clientSecret: 'test-secret',
      webhookId: 'webhook-1',
      fetcher,
      now: () => now,
    });
    const headers = new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/v1/notifications/certs/test',
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-sig': 'signature',
      'paypal-transmission-time': new Date(now).toISOString(),
    });
    const event = { id: 'event-1', event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED' };
    expect(await provider.verifyWebhook(headers, event)).toBe(true);
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      webhook_id: 'webhook-1',
      webhook_event: event,
    });
    expect(await provider.verifyWebhook(headers, event)).toBe(false);
  });

  it('demo payouts remain explicitly synthetic and cannot accept Sandbox intents/webhooks', async () => {
    const demo = new DemoPayoutProvider();
    await expect(demo.createPayout(intent())).rejects.toThrow();
    const saved = intent({ mode: 'demo' });
    const submission = await demo.createPayout(saved);
    expect(submission.providerStatus).toBe('DEMO_PROCESSING');
    const result = await demo.reconcilePayout({
      ...saved,
      providerBatchId: submission.providerBatchId,
    });
    expect(result).toMatchObject({
      status: 'paid',
      providerStatus: 'DEMO_SUCCESS',
      transactionId: 'demo-txn-intent-1',
    });
    expect(await demo.verifyWebhook()).toBe(false);
  });
});
