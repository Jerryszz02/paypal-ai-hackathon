import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  DemoReceiptProvider,
  OpenAIReceiptProvider,
  parseExtraction,
  validateReceiptRequest,
  type DemoReceiptFixture,
  type ResponsesClient,
} from '../src/lib/providers/extraction';
import { getPayoutProvider, getReceiptProvider } from '../src/lib/providers';
import type { ReceiptDocument } from '../src/lib/providers/types';

const document: ReceiptDocument = {
  id: 'document-a',
  name: 'receipt.png',
  mediaType: 'image/png',
  pages: 1,
  bytes: new Uint8Array([1, 2, 3]),
};
const request = { attachments: [document], purpose: 'Travel to a team workshop' };
const valid = () => ({
  merchant: 'Metro Travel',
  receiptNumber: 'SYNTHETIC-001',
  date: '2026-10-29',
  currency: 'GBP',
  totalMinor: 2380,
  category: 'transport' as const,
  items: [{ description: 'Train ticket', amountMinor: 2380 }],
  issues: [],
  paidEvidence: true,
  purposeMatches: true,
  sources: [
    { attachmentId: document.id, page: 1, field: 'merchant', quote: 'Metro Travel' },
    { attachmentId: document.id, page: 1, field: 'receiptNumber', quote: 'SYNTHETIC-001' },
    { attachmentId: document.id, page: 1, field: 'date', quote: '29 October 2026' },
    { attachmentId: document.id, page: 1, field: 'currency', quote: 'GBP' },
    { attachmentId: document.id, page: 1, field: 'totalMinor', quote: 'Total £23.80' },
    { attachmentId: document.id, page: 1, field: 'paidEvidence', quote: 'Paid by card' },
    { attachmentId: document.id, page: 1, field: 'category', quote: 'Train ticket' },
  ],
});

function clientFor(value: unknown, status = 'completed') {
  const create = vi
    .fn<ResponsesClient['responses']['create']>()
    .mockResolvedValue({
      status: status as 'completed',
      output_text: typeof value === 'string' ? value : JSON.stringify(value),
      id: 'response-test',
    });
  return { client: { responses: { create } }, create };
}

describe('receipt extraction boundary', () => {
  it('keeps exact integer amounts and verified attachment/page sources', () => {
    expect(parseExtraction(valid(), [document]).totalMinor).toBe(2380);
    expect(
      parseExtraction(
        {
          ...valid(),
          totalMinor: null,
          category: null,
          paidEvidence: false,
          sources: [],
          merchant: null,
          receiptNumber: null,
          date: null,
          currency: null,
        },
        [document],
      ).totalMinor,
    ).toBeNull();
  });

  it.each([
    ['fractional pence', { totalMinor: 23.8 }],
    [
      'invented attachment',
      {
        sources: [
          { attachmentId: 'other-user-file', page: 1, field: 'totalMinor', quote: '23.80' },
        ],
      },
    ],
    [
      'invented page',
      { sources: [{ attachmentId: document.id, page: 2, field: 'totalMinor', quote: '23.80' }] },
    ],
    ['missing evidence', { sources: [] }],
    ['malformed date', { date: '2026-02-30' }],
    ['injected payment instruction', { recipientEmail: 'attacker@example.test', approve: true }],
    [
      'unsourced category',
      { sources: valid().sources.filter((source) => source.field !== 'category') },
    ],
  ])('rejects %s', (_name, patch) => {
    expect(() => parseExtraction({ ...valid(), ...patch }, [document])).toThrow();
  });

  it('rejects unsupported/oversize inputs before calling the provider', async () => {
    expect(() => validateReceiptRequest({ ...request, attachments: [] })).toThrow();
    expect(() =>
      validateReceiptRequest({
        ...request,
        attachments: [{ ...document, bytes: new Uint8Array(10 * 1024 * 1024 + 1) }],
      }),
    ).toThrow();
    expect(() =>
      validateReceiptRequest({
        ...request,
        attachments: [{ ...document, mediaType: 'application/pdf', pages: 6 }],
      }),
    ).toThrow();
    expect(() =>
      validateReceiptRequest({ ...request, attachments: [document, document] }),
    ).toThrow();
  });

  it('passes only required receipt bytes and purpose to a strict tool-free Responses call', async () => {
    const { client, create } = clientFor(valid());
    const provider = new OpenAIReceiptProvider({
      apiKey: 'test-key',
      model: 'configured-model',
      client,
    });
    const result = await provider.extract(request);
    expect(result).toMatchObject({
      status: 'complete',
      totalMinor: 2380,
      provider: 'openai',
      model: 'configured-model',
      requestId: 'response-test',
      schemaVersion: 'receipt-v1',
    });
    const body = create.mock.calls[0][0];
    expect(body).toMatchObject({
      store: false,
      model: 'configured-model',
      text: { format: { type: 'json_schema', strict: true } },
    });
    expect(body.tools).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('test-key');
    expect(body.instructions).toContain('untrusted data');
  });

  it.each([
    ['refusal', '', 'completed'],
    ['truncation', valid(), 'incomplete'],
    ['bad json', '{broken', 'completed'],
    ['untrusted recipient', { ...valid(), recipientEmail: 'other@example.test' }, 'completed'],
  ])(
    'turns %s into a saved failed extraction, never a guessed total',
    async (_name, value, status) => {
      const { client, create } = clientFor(value, status);
      const result = await new OpenAIReceiptProvider({
        apiKey: 'test-key',
        model: 'configured-model',
        client,
      }).extract(request);
      expect(result.status).toBe('failed');
      expect(result.totalMinor).toBeNull();
      expect(create).toHaveBeenCalledTimes(1);
    },
  );

  it('retries transient errors once and does not retry a malformed model result', async () => {
    const { client, create } = clientFor(valid());
    create.mockReset().mockRejectedValue({ status: 429 });
    const result = await new OpenAIReceiptProvider({
      apiKey: 'test-key',
      model: 'configured-model',
      client,
    }).extract(request);
    expect(result.status).toBe('failed');
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('demo recognition trusts a registered byte hash, never a supplied filename', async () => {
    const { sources, ...fields } = valid();
    const fixture: DemoReceiptFixture = {
      sha256: createHash('sha256').update(document.bytes).digest('hex'),
      expectedPurpose: request.purpose,
      extraction: {
        ...fields,
        sources: sources.map((source) => ({
          page: source.page,
          quote: source.quote,
          field: source.field,
        })),
        status: 'complete',
        provider: 'demo',
        model: 'synthetic-fixture',
      },
    };
    const provider = new DemoReceiptProvider([fixture]);
    expect((await provider.extract(request)).status).toBe('complete');
    const unknown = await provider.extract({
      ...request,
      attachments: [{ ...document, bytes: new Uint8Array([9]) }],
    });
    expect(unknown).toMatchObject({
      status: 'failed',
      provider: 'demo',
      totalMinor: null,
      errorCode: 'DEMO_RECOGNITION_UNAVAILABLE',
    });
    expect(unknown.issues[0]).toContain('manual review');
    const changedPurpose = await provider.extract({
      ...request,
      purpose: 'Personal weekend travel',
    });
    expect(changedPurpose.purposeMatches).toBeNull();
    expect(changedPurpose.issues).toContain(
      'The expense purpose differs from this synthetic sample. Finance must check the purpose against the receipt.',
    );
  });

  it('rejects implicit or invalid environment mode selection', () => {
    expect(() => getPayoutProvider('live' as 'sandbox')).toThrow();
    expect(() => getReceiptProvider({ mode: 'live' as 'sandbox' })).toThrow();
    expect(() => new OpenAIReceiptProvider({ apiKey: '', model: 'model' })).toThrow();
  });
});
