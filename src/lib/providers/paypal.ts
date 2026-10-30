import 'server-only';
import type { PaymentIntent, PaymentStatus, VerifiedPaymentResult } from '../types';
import { ProviderError, type PayoutProvider, type PayoutSubmission } from './types';

const SANDBOX_ORIGIN = 'https://api-m.sandbox.paypal.com';
const RETRY_WINDOW_MS = 29 * 24 * 60 * 60 * 1000; // Leave margin inside PayPal's 30-day deduplication window.
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as JsonRecord) : {};
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

export function payoutAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor <= 0 || minor > 100_000_000)
    throw new ProviderError('INVALID_PAYOUT', 'The payout amount is invalid.');
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

function parseAmount(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fractional = ''] = value.split('.');
  const amount = Number(whole) * 100 + Number(fractional.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : null;
}

function validateIntent(intent: PaymentIntent): void {
  payoutAmount(intent.amountMinor);
  if (
    intent.currency !== 'GBP' ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(intent.recipientEmail) ||
    intent.recipientEmail.length > 127 ||
    !intent.senderBatchId ||
    intent.senderBatchId.length > 256 ||
    !intent.senderItemId ||
    intent.senderItemId.length > 63 ||
    !intent.id ||
    intent.id.length > 1000 ||
    intent.mode !== 'sandbox'
  ) {
    throw new ProviderError('INVALID_PAYOUT', 'The frozen Sandbox payout parameters are invalid.');
  }
}

export function mapPayPalItemStatus(status: string): PaymentStatus {
  switch (status) {
    case 'SUCCESS':
      return 'paid';
    case 'UNCLAIMED':
      return 'unclaimed';
    case 'FAILED':
    case 'DENIED':
      return 'failed';
    case 'RETURNED':
    case 'REFUNDED':
    case 'REVERSED':
      return 'returned';
    case 'CANCELED':
    case 'CANCELLED':
      return 'cancelled';
    case 'PENDING':
    case 'PROCESSING':
      return 'processing';
    // BLOCKED / ONHOLD need investigation; retain the reservation until funds are definitively reconciled.
    default:
      return 'unknown';
  }
}

/** Every successful/terminal result must be read from an individual item, never a batch or webhook. */
export function validatePayPalItem(
  intent: PaymentIntent,
  body: unknown,
  verifiedSenderBatchId?: string,
): VerifiedPaymentResult {
  const item = record(body);
  const payout = record(item.payout_item);
  const amount = record(payout.amount);
  // sender_batch_id is optional in PayPal's item schema. A fresh, verified batch header
  // establishes this link when the item omits it; a present mismatch is always rejected.
  const senderMatches = Object.hasOwn(item, 'sender_batch_id')
    ? item.sender_batch_id === intent.senderBatchId
    : verifiedSenderBatchId === intent.senderBatchId;
  const senderItemMatches = Object.hasOwn(payout, 'sender_item_id')
    ? payout.sender_item_id === intent.senderItemId
    : verifiedSenderBatchId === intent.senderBatchId;
  const recipientTypeMatches =
    !Object.hasOwn(payout, 'recipient_type') || payout.recipient_type === 'EMAIL';
  if (
    !nonempty(item.payout_batch_id) ||
    item.payout_batch_id !== intent.providerBatchId ||
    !nonempty(item.payout_item_id) ||
    (intent.providerItemId && item.payout_item_id !== intent.providerItemId) ||
    !senderMatches ||
    !senderItemMatches ||
    !recipientTypeMatches ||
    String(payout.receiver).toLowerCase() !== intent.recipientEmail.toLowerCase() ||
    amount.currency !== intent.currency ||
    parseAmount(amount.value) !== intent.amountMinor ||
    !nonempty(item.transaction_status)
  ) {
    throw new ProviderError(
      'PAYOUT_MISMATCH',
      'PayPal returned a different payout. Keep this payment on hold for reconciliation.',
    );
  }
  const status = mapPayPalItemStatus(item.transaction_status);
  if (status === 'paid' && !nonempty(item.transaction_id))
    throw new ProviderError(
      'PAYOUT_MISMATCH',
      'PayPal has not returned a transaction identifier for the completed item.',
    );
  return {
    status,
    amountMinor: intent.amountMinor,
    currency: intent.currency,
    recipientEmail: intent.recipientEmail,
    senderBatchId: intent.senderBatchId,
    senderItemId: intent.senderItemId,
    providerBatchId: item.payout_batch_id,
    providerItemId: item.payout_item_id,
    transactionId: nonempty(item.transaction_id) ? item.transaction_id : null,
    providerStatus: item.transaction_status,
    failureCode:
      typeof record(item.errors).name === 'string'
        ? String(record(item.errors).name).slice(0, 100)
        : null,
  };
}

export class PayPalSandboxProvider implements PayoutProvider {
  private token: { value: string; expiresAt: number } | null = null;
  private tokenPromise: Promise<string> | null = null;
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  constructor(
    private readonly options: {
      clientId: string;
      clientSecret: string;
      webhookId?: string;
      fetcher?: typeof fetch;
      now?: () => number;
    },
  ) {
    if (!options.clientId || !options.clientSecret)
      throw new ProviderError(
        'PAYPAL_NOT_CONFIGURED',
        'Configure the server PayPal Sandbox credentials before sending payouts.',
      );
    this.fetcher = options.fetcher ?? fetch;
    this.now = options.now ?? Date.now;
  }

  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    if (this.tokenPromise) return this.tokenPromise;
    this.tokenPromise = (async () => {
      const response = await this.fetcher(`${SANDBOX_ORIGIN}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.options.clientId}:${this.options.clientSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
        redirect: 'error',
      });
      const body = record(await response.json());
      if (
        !response.ok ||
        !nonempty(body.access_token) ||
        typeof body.expires_in !== 'number' ||
        body.expires_in <= 0
      )
        throw new ProviderError(
          'PAYPAL_AUTH_FAILED',
          'PayPal Sandbox authentication failed. Check the server configuration.',
        );
      this.token = {
        value: body.access_token,
        expiresAt: this.now() + Math.max(0, body.expires_in - 60) * 1000,
      };
      return body.access_token;
    })();
    try {
      return await this.tokenPromise;
    } finally {
      this.tokenPromise = null;
    }
  }

  private async request(
    path: string,
    init: RequestInit = {},
  ): Promise<{ response: Response; body: JsonRecord }> {
    const token = await this.getToken();
    const response = await this.fetcher(`${SANDBOX_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
      redirect: 'error',
    });
    const body = record(await response.json());
    return { response, body };
  }

  async createPayout(intent: PaymentIntent): Promise<PayoutSubmission> {
    validateIntent(intent);
    if (intent.providerBatchId)
      return {
        status: 'processing',
        providerBatchId: intent.providerBatchId,
        providerStatus: 'RECONCILE_EXISTING',
      };
    const started = Date.parse(intent.sentAt ?? intent.createdAt);
    if (
      !Number.isFinite(started) ||
      started > this.now() ||
      this.now() - started >= RETRY_WINDOW_MS
    ) {
      return {
        status: 'unknown',
        providerBatchId: null,
        providerStatus: 'UNKNOWN',
        failureCode: 'RETRY_WINDOW_EXPIRED',
      };
    }
    try {
      const { response, body } = await this.request('/v1/payments/payouts', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': intent.id },
        body: JSON.stringify({
          sender_batch_header: { sender_batch_id: intent.senderBatchId, recipient_type: 'EMAIL' },
          items: [
            {
              recipient_type: 'EMAIL',
              amount: { value: payoutAmount(intent.amountMinor), currency: intent.currency },
              receiver: intent.recipientEmail,
              sender_item_id: intent.senderItemId,
              recipient_wallet: 'PAYPAL',
            },
          ],
        }),
      });
      const batch = record(body.batch_header);
      const echoedHeader = record(batch.sender_batch_header);
      const echoedSenderMatches =
        !Object.hasOwn(echoedHeader, 'sender_batch_id') ||
        echoedHeader.sender_batch_id === intent.senderBatchId;
      if (response.ok && nonempty(batch.payout_batch_id) && echoedSenderMatches) {
        // Even a SUCCESS batch is only accepted here; item reconciliation establishes arrival.
        return {
          status: 'processing',
          providerBatchId: batch.payout_batch_id,
          providerStatus: typeof batch.batch_status === 'string' ? batch.batch_status : 'ACCEPTED',
        };
      }
      if (!response.ok && JSON.stringify(body).includes('DUPLICATE_BATCH_ID')) {
        const links = [
          ...(Array.isArray(body.links) ? body.links : []),
          ...(Array.isArray(body.details)
            ? body.details.flatMap((detail) =>
                Array.isArray(record(detail).links) ? (record(detail).links as unknown[]) : [],
              )
            : []),
        ];
        for (const link of links) {
          const href = record(link).href;
          if (typeof href !== 'string') continue;
          let url: URL;
          try {
            url = new URL(href);
          } catch {
            continue;
          }
          const match = url.pathname.match(/^\/v1\/payments\/payouts\/([A-Za-z0-9_-]+)$/);
          if (url.origin === SANDBOX_ORIGIN && match)
            return {
              status: 'processing',
              providerBatchId: match[1],
              providerStatus: 'DUPLICATE_RECOVERED',
            };
        }
      }
      // Failed submissions remain unknown until an authoritative lookup proves they cannot arrive.
      return {
        status: 'unknown',
        providerBatchId: null,
        providerStatus: 'UNKNOWN',
        failureCode: response.ok ? 'INVALID_PAYPAL_RESPONSE' : `PAYPAL_HTTP_${response.status}`,
      };
    } catch {
      return {
        status: 'unknown',
        providerBatchId: null,
        providerStatus: 'UNKNOWN',
        failureCode: 'PAYPAL_REQUEST_UNCERTAIN',
      };
    }
  }

  async reconcilePayout(intent: PaymentIntent): Promise<VerifiedPaymentResult> {
    validateIntent(intent);
    if (!intent.providerBatchId)
      throw new ProviderError(
        'PAYOUT_ID_UNKNOWN',
        'Recover the original payout using its saved request ID before querying its status.',
      );
    const { response: batchResponse, body: batchBody } = await this.request(
      `/v1/payments/payouts/${encodeURIComponent(intent.providerBatchId)}?page_size=10&total_required=true`,
    );
    const batch = record(batchBody.batch_header);
    if (!batchResponse.ok)
      throw new ProviderError(
        'PAYPAL_QUERY_FAILED',
        'The PayPal payout status could not be checked. Keep the original payment on hold.',
      );
    if (
      batch.payout_batch_id !== intent.providerBatchId ||
      record(batch.sender_batch_header).sender_batch_id !== intent.senderBatchId ||
      !Array.isArray(batchBody.items) ||
      batchBody.items.length !== 1 ||
      (typeof batchBody.total_items === 'number' && batchBody.total_items !== 1)
    ) {
      throw new ProviderError(
        'PAYOUT_MISMATCH',
        'PayPal returned a different payout batch. Keep this payment on hold for reconciliation.',
      );
    }
    const summary = record(batchBody.items[0]);
    const summaryPayout = record(summary.payout_item);
    if (
      (Object.hasOwn(summaryPayout, 'sender_item_id') &&
        summaryPayout.sender_item_id !== intent.senderItemId) ||
      !nonempty(summary.payout_item_id) ||
      (intent.providerItemId && summary.payout_item_id !== intent.providerItemId)
    )
      throw new ProviderError('PAYOUT_MISMATCH', 'The expected PayPal payout item is missing.');
    const itemId = summary.payout_item_id;
    const { response, body } = await this.request(
      `/v1/payments/payouts-item/${encodeURIComponent(itemId)}`,
    );
    if (!response.ok)
      throw new ProviderError(
        'PAYPAL_QUERY_FAILED',
        'The PayPal payout item could not be checked. Keep the original payment on hold.',
      );
    return validatePayPalItem({ ...intent, providerItemId: itemId }, body, intent.senderBatchId);
  }

  async verifyWebhook(headers: Headers, event: unknown): Promise<boolean> {
    if (
      !this.options.webhookId ||
      !nonempty(record(event).id) ||
      !nonempty(record(event).event_type)
    )
      return false;
    const names = [
      'paypal-auth-algo',
      'paypal-cert-url',
      'paypal-transmission-id',
      'paypal-transmission-sig',
      'paypal-transmission-time',
    ];
    if (names.some((name) => !headers.get(name) || headers.get(name)!.length > 4096)) return false;
    try {
      const cert = new URL(headers.get('paypal-cert-url')!);
      if (
        cert.protocol !== 'https:' ||
        !(cert.hostname === 'paypal.com' || cert.hostname.endsWith('.paypal.com')) ||
        cert.username ||
        cert.password
      )
        return false;
      const { response, body } = await this.request('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: JSON.stringify({
          auth_algo: headers.get('paypal-auth-algo'),
          cert_url: headers.get('paypal-cert-url'),
          transmission_id: headers.get('paypal-transmission-id'),
          transmission_sig: headers.get('paypal-transmission-sig'),
          transmission_time: headers.get('paypal-transmission-time'),
          webhook_id: this.options.webhookId,
          webhook_event: event,
        }),
      });
      return response.ok && body.verification_status === 'SUCCESS';
    } catch {
      return false;
    }
  }
}

/** Deliberately synthetic: no network calls, never described as a Sandbox transaction. */
export class DemoPayoutProvider implements PayoutProvider {
  async createPayout(intent: PaymentIntent): Promise<PayoutSubmission> {
    if (intent.mode !== 'demo')
      throw new ProviderError(
        'MODE_MISMATCH',
        'Demo payouts cannot process Sandbox payment intents.',
      );
    return {
      status: 'processing',
      providerBatchId: `demo-${intent.id}`,
      providerStatus: 'DEMO_PROCESSING',
    };
  }
  async reconcilePayout(intent: PaymentIntent): Promise<VerifiedPaymentResult> {
    if (intent.mode !== 'demo' || intent.providerBatchId !== `demo-${intent.id}`)
      throw new ProviderError('MODE_MISMATCH', 'This is not a saved demo payout.');
    return {
      status: 'paid',
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      recipientEmail: intent.recipientEmail,
      senderBatchId: intent.senderBatchId,
      senderItemId: intent.senderItemId,
      providerBatchId: intent.providerBatchId,
      providerItemId: `demo-item-${intent.id}`,
      transactionId: `demo-txn-${intent.id}`,
      providerStatus: 'DEMO_SUCCESS',
    };
  }
  async verifyWebhook(): Promise<boolean> {
    return false;
  }
}
