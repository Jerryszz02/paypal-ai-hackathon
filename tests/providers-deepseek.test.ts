import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'node:crypto';
import { PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import {
  DeepSeekReceiptProvider,
  OpenAIReceiptProvider,
  getReceiptProvider,
} from '../src/lib/providers';
import type { ResponsesClient } from '../src/lib/providers/extraction';
import { prepareDeepSeekImages } from '../src/lib/providers/receipt-images';
import type { ReceiptDocument } from '../src/lib/providers/types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const facts = (page = 1) => ({
  merchant: 'Synthetic shop',
  receiptNumber: null,
  date: null,
  currency: 'GBP',
  totalMinor: 1200,
  category: 'office_supplies',
  items: [],
  issues: [],
  paidEvidence: false,
  purposeMatches: null,
  sources: ['merchant', 'currency', 'totalMinor', 'category'].map((field) => ({
    attachmentId: 'receipt-one',
    page,
    field,
    quote: 'Synthetic shop GBP 12.00 stationery',
  })),
});
function responseClient(value: unknown = facts()) {
  const create = vi
    .fn<ResponsesClient['responses']['create']>()
    .mockResolvedValue({
      status: 'completed',
      id: 'deepseek-test',
      output_text: JSON.stringify(value),
    });
  return { create, client: { responses: { create } } };
}
function provider(client: ResponsesClient) {
  return new DeepSeekReceiptProvider({
    apiKey: 'test-only-key',
    model: 'deepseek-flash',
    client,
  });
}
async function png(width = 80, height = 100): Promise<ReceiptDocument> {
  return {
    id: 'receipt-one',
    name: 'synthetic.png',
    mediaType: 'image/png',
    pages: 1,
    bytes: await sharp({
      create: { width, height, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer(),
  };
}
async function pdf(
  pages = 2,
  width = 200,
  height = 300,
): Promise<ReceiptDocument> {
  const document = await PDFDocument.create();
  for (let number = 0; number < pages; number++) {
    const page = document.addPage([width, height]);
    page.drawRectangle({
      width,
      height,
      color: number % 2 ? rgb(0, 0, 1) : rgb(1, 0, 0),
    });
    page.drawText('SYNTHETIC RECEIPT', { x: 10, y: 30, size: 10 });
  }
  return {
    id: 'receipt-one',
    name: 'synthetic.pdf',
    mediaType: 'application/pdf',
    pages,
    bytes: await document.save(),
  };
}
function contentFrom(create: ReturnType<typeof responseClient>['create']) {
  const input = create.mock.calls[0][0].input as {
    content: { type: string; text?: string; image_url?: string }[];
  }[];
  return input[0].content;
}

async function correctedPdf(
  kind: 'Stamp' | 'FreeText' | 'form' | 'Link',
): Promise<ReceiptDocument> {
  const document = await PDFDocument.create();
  const page = document.addPage([300, 200]);
  page.drawText('Original total GBP 12.00', { x: 10, y: 160, size: 16 });
  if (kind === 'form') {
    const field = document.getForm().createTextField('corrected_total');
    field.setText('Corrected total GBP 99.00');
    field.addToPage(page, { x: 10, y: 80, width: 280, height: 40 });
  } else {
    const font = await document.embedFont(StandardFonts.Helvetica);
    const appearance = document.context.register(
      document.context.flateStream(
        'q 1 1 1 rg 0 0 280 40 re f BT /F1 16 Tf 1 0 0 rg 10 12 Td (Corrected total GBP 99.00) Tj ET Q',
        {
          Type: 'XObject',
          Subtype: 'Form',
          BBox: [0, 0, 280, 40],
          Resources: { Font: { F1: font.ref } },
        },
      ),
    );
    const annotation = document.context.register(
      document.context.obj({
        Type: 'Annot',
        Subtype: kind,
        Rect: [10, 80, 290, 120],
        F: 4,
        Contents: PDFString.of('Corrected total GBP 99.00'),
        AP: { N: appearance },
      }),
    );
    page.node.set(PDFName.of('Annots'), document.context.obj([annotation]));
  }
  return {
    id: 'receipt-one',
    name: 'corrected.pdf',
    mediaType: 'application/pdf',
    pages: 1,
    bytes: await document.save(),
  };
}

describe('DeepSeek receipt adapter', () => {
  it.each(['Stamp', 'FreeText', 'form', 'Link'] as const)(
    'routes a PDF with a visible %s correction to manual review before model input',
    async (kind) => {
      const { client, create } = responseClient();
      const result = await provider(client).extract({
        attachments: [await correctedPdf(kind)],
        purpose: '',
      });
      expect(result).toMatchObject({
        status: 'failed',
        totalMinor: null,
        errorCode: 'PDF_APPEARANCE_REQUIRES_REVIEW',
      });
      expect(result.issues.join(' ')).toContain('manual review');
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('retains a normal link-only PDF without an appearance stream', async () => {
    const document = await PDFDocument.create();
    const page = document.addPage([300, 200]);
    page.drawText('Total GBP 12.00', { x: 10, y: 160, size: 16 });
    const annotation = document.context.register(
      document.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [10, 10, 150, 30],
        Border: [0, 0, 0],
        A: {
          S: 'URI',
          URI: PDFString.of('https://example.test/synthetic-receipt'),
        },
      }),
    );
    page.node.set(PDFName.of('Annots'), document.context.obj([annotation]));
    const { client, create } = responseClient();
    const result = await provider(client).extract({
      attachments: [
        {
          id: 'receipt-one',
          name: 'link-only.pdf',
          mediaType: 'application/pdf',
          pages: 1,
          bytes: await document.save(),
        },
      ],
      purpose: '',
    });
    expect(result.status).toBe('complete');
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('uses the fixed DeepSeek endpoint and a strict, tool-free image request', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          object: 'response',
          id: 'response-http',
          status: 'completed',
          output: [
            {
              type: 'message',
              id: 'message-test',
              role: 'assistant',
              status: 'completed',
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify(facts()),
                  annotations: [],
                },
              ],
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    const result = await new DeepSeekReceiptProvider({
      apiKey: 'test-only-key',
      model: 'deepseek-flash',
    }).extract({
      attachments: [await png()],
      purpose: 'Stationery for workshop',
    });
    expect(result).toMatchObject({
      provider: 'deepseek',
      status: 'complete',
      totalMinor: 1200,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://api.deepseek.com/responses');
    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: 'deepseek-flash',
      store: false,
      reasoning: { effort: 'none' },
      text: { format: { type: 'json_schema', strict: true } },
    });
    expect(body.tools).toBeUndefined();
    expect(body.instructions).toContain('untrusted data');
    expect(JSON.stringify(body)).not.toContain('test-only-key');
    expect(
      body.input[0].content.some(
        (part: { type: string }) => part.type === 'input_image',
      ),
    ).toBe(true);
  });

  it('renders every PDF page locally with the original attachment and page markers', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('External resources forbidden'));
    const { client, create } = responseClient(facts(2));
    const result = await provider(client).extract({
      attachments: [await pdf()],
      purpose: 'Stationery',
    });
    expect(result).toMatchObject({ status: 'complete', provider: 'deepseek' });
    expect(
      result.sources.every(
        (source) => source.page === 2 && source.attachmentId === 'receipt-one',
      ),
    ).toBe(true);
    const content = contentFrom(create);
    expect(content.filter((part) => part.type === 'input_file')).toHaveLength(
      0,
    );
    const images = content.filter((part) => part.type === 'input_image');
    expect(images).toHaveLength(2);
    expect(
      content
        .filter((part) => part.type === 'input_text')
        .map((part) => part.text)
        .join('\n'),
    ).toContain('attachmentId="receipt-one", page=2');
    const first = await sharp(
      Buffer.from(images[0].image_url!.split(',')[1], 'base64'),
    )
      .raw()
      .toBuffer();
    const second = await sharp(
      Buffer.from(images[1].image_url!.split(',')[1], 'base64'),
    )
      .raw()
      .toBuffer();
    expect(Array.from(first.subarray(0, 3))).toEqual([255, 0, 0]);
    expect(Array.from(second.subarray(0, 3))).toEqual([0, 0, 255]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rotates JPEGs and bounds decoded image dimensions and pixel area', async () => {
    const rotated: ReceiptDocument = {
      ...(await png()),
      mediaType: 'image/jpeg',
      name: 'rotated.jpg',
      bytes: await sharp({
        create: { width: 300, height: 100, channels: 3, background: 'white' },
      })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    };
    const images = await prepareDeepSeekImages({
      attachments: [rotated, { ...(await png(2400, 2400)), id: 'square' }],
      purpose: '',
    });
    const rotation = await sharp(images[0].bytes).metadata();
    expect([rotation.width, rotation.height]).toEqual([100, 300]);
    const square = await sharp(images[1].bytes).metadata();
    expect(square.width! * square.height!).toBeLessThanOrEqual(4_000_000);
    expect(Math.max(square.width!, square.height!)).toBeLessThanOrEqual(2400);
  });

  it('renders a scanned PDF receipt with an embedded high-resolution JPEG', async () => {
    const document = await PDFDocument.create();
    const image = await document.embedJpg(
      await sharp({
        create: {
          width: 2600,
          height: 3200,
          channels: 3,
          background: '#00ff00',
        },
      })
        .jpeg()
        .toBuffer(),
    );
    // The same image ref is reused across five pages: decoded source pixels count once.
    for (let page = 0; page < 5; page++)
      document
        .addPage([260, 320])
        .drawImage(image, { x: 0, y: 0, width: 260, height: 320 });
    const { client } = responseClient();
    const result = await provider(client).extract({
      attachments: [
        {
          ...(await pdf(5)),
          bytes: await document.save(),
        },
      ],
      purpose: '',
    });
    expect(result).toMatchObject({ status: 'complete', provider: 'deepseek' });
  });

  it('draws an unembedded standard font from local bundled assets', async () => {
    const document = await PDFDocument.create();
    document
      .addPage([300, 100])
      .drawText('SYNTHETIC GBP 12.00', { x: 10, y: 40, size: 20 });
    const images = await prepareDeepSeekImages({
      attachments: [{ ...(await pdf(1)), bytes: await document.save() }],
      purpose: '',
    });
    const pixels = await sharp(images[0].bytes).removeAlpha().raw().toBuffer();
    let darkPixels = 0;
    for (let index = 0; index < pixels.length; index += 3)
      if (
        pixels[index] < 100 &&
        pixels[index + 1] < 100 &&
        pixels[index + 2] < 100
      )
        darkPixels++;
    expect(darkPixels).toBeGreaterThan(1000);
  });

  it('bounds aggregate PDF image pixels, including images inside nested Forms', async () => {
    const document = await PDFDocument.create();
    const images = Array.from({ length: 3 }, () =>
      document.context.register(
        document.context.flateStream(new Uint8Array([255]), {
          Type: PDFName.of('XObject'),
          Subtype: PDFName.of('Image'),
          Width: 4000,
          Height: 4000,
          ColorSpace: PDFName.of('DeviceGray'),
          BitsPerComponent: 8,
        }),
      ),
    );
    const inner = document.context.register(
      document.context.flateStream('', {
        Type: PDFName.of('XObject'),
        Subtype: PDFName.of('Form'),
        BBox: [0, 0, 100, 100],
        Resources: {
          XObject: { First: images[0], Second: images[1], Third: images[2] },
        },
      }),
    );
    const outer = document.context.register(
      document.context.flateStream('/Inner Do', {
        Type: PDFName.of('XObject'),
        Subtype: PDFName.of('Form'),
        BBox: [0, 0, 100, 100],
        Resources: { XObject: { Inner: inner } },
      }),
    );
    const page = document.addPage([100, 100]);
    page.node.set(
      PDFName.of('Resources'),
      document.context.obj({ XObject: { Outer: outer } }),
    );
    const { client, create } = responseClient();
    const result = await provider(client).extract({
      attachments: [{ ...(await pdf(1)), bytes: await document.save() }],
      purpose: '',
    });
    // Three unique 16 MP image streams must fail before optional image decoding starts.
    expect(result).toMatchObject({
      status: 'failed',
      totalMinor: null,
      errorCode: 'DOCUMENT_LIMIT',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('keeps OpenAI as an explicit option and rejects unsupported DeepSeek models', () => {
    vi.stubEnv('AI_API_KEY', 'test-only-key');
    vi.stubEnv('AI_MODEL', 'deepseek-flash');
    vi.stubEnv('AI_PROVIDER', 'deepseek');
    expect(getReceiptProvider({ mode: 'sandbox' })).toBeInstanceOf(
      DeepSeekReceiptProvider,
    );
    vi.stubEnv('AI_PROVIDER', 'openai');
    expect(getReceiptProvider({ mode: 'sandbox' })).toBeInstanceOf(
      OpenAIReceiptProvider,
    );
    vi.stubEnv('AI_PROVIDER', 'unknown');
    expect(() => getReceiptProvider({ mode: 'sandbox' })).toThrow();
    expect(
      () =>
        new DeepSeekReceiptProvider({
          apiKey: 'test-only-key',
          model: 'deepseek-v4-pro',
        }),
    ).toThrow();
  });

  it('does not send a malformed, active, miscounted or extreme PDF, or a partial conversion', async () => {
    const active = await PDFDocument.create();
    active.addPage();
    active.catalog.set(
      PDFName.of('OpenAction'),
      active.context.obj({
        S: PDFName.of('JavaScript'),
        JS: PDFString.of('app.alert("untrusted")'),
      }),
    );
    const first = await pdf();
    const documents = [
      { ...first, bytes: new Uint8Array([1, 2, 3]) },
      { ...first, bytes: await active.save(), pages: 1 },
      { ...first, pages: 1 },
      await pdf(1, 50_000, 300),
    ];
    for (const document of documents) {
      const { client, create } = responseClient();
      const result = await provider(client).extract({
        attachments: [document],
        purpose: '',
      });
      expect(result).toMatchObject({
        status: 'failed',
        provider: 'deepseek',
        totalMinor: null,
        errorCode: 'DOCUMENT_PREPARATION_FAILED',
      });
      expect(create).not.toHaveBeenCalled();
    }
    const { client, create } = responseClient();
    const partial = await provider(client).extract({
      attachments: [await png(), { ...documents[0], id: 'second' }],
      purpose: '',
    });
    expect(partial.status).toBe('failed');
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects excess PDF pages and an expired conversion deadline before recognition', async () => {
    const { client, create } = responseClient();
    await expect(
      provider(client).extract({ attachments: [await pdf(6)], purpose: '' }),
    ).rejects.toMatchObject({ code: 'DOCUMENT_LIMIT' });
    expect(create).not.toHaveBeenCalled();
    await expect(
      prepareDeepSeekImages({ attachments: [await pdf()], purpose: '' }, 1),
    ).rejects.toMatchObject({ code: 'DOCUMENT_PREPARATION_TIMEOUT' });
  });

  it('rejects optional PDF image decoders and encoded-image expansion before any model call', async () => {
    const document = await PDFDocument.create();
    document.addPage();
    document.context.register(
      document.context.stream(new Uint8Array([1]), {
        Type: PDFName.of('XObject'),
        Subtype: PDFName.of('Image'),
        Width: 1,
        Height: 1,
        Filter: PDFName.of('JPXDecode'),
      }),
    );
    const { client, create } = responseClient();
    const rejected = await provider(client).extract({
      attachments: [{ ...(await pdf(1)), bytes: await document.save() }],
      purpose: '',
    });
    expect(rejected).toMatchObject({
      status: 'failed',
      errorCode: 'DOCUMENT_PREPARATION_FAILED',
    });
    const noise = await sharp(randomBytes(2000 * 2000 * 3), {
      raw: { width: 2000, height: 2000, channels: 3 },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
    const image: ReceiptDocument = {
      id: 'receipt-one',
      name: 'synthetic-noise.jpg',
      mediaType: 'image/jpeg',
      pages: 1,
      bytes: noise,
    };
    const expanded = await provider(client).extract({
      attachments: [image, { ...image, id: 'second' }],
      purpose: '',
    });
    expect(expanded).toMatchObject({
      status: 'failed',
      errorCode: 'DOCUMENT_LIMIT',
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('continues to reject invented sources and payment instructions in a DeepSeek response', async () => {
    for (const invalid of [
      facts(2),
      { ...facts(), recipientEmail: 'attacker@example.test' },
    ]) {
      const { client, create } = responseClient(invalid);
      const result = await provider(client).extract({
        attachments: [await png()],
        purpose: '',
      });
      expect(result).toMatchObject({
        provider: 'deepseek',
        status: 'failed',
        totalMinor: null,
      });
      expect(create).toHaveBeenCalledTimes(1);
    }
  });
});
