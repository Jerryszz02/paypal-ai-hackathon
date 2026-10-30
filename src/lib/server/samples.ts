import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { ClaimInput, Extraction } from '@/lib/types';
import type { ReimbursementService } from '@/lib/domain/service';
import { dateInZone } from '@/lib/domain/rules';
import { getReceiptProvider } from '@/lib/providers';
import type { DemoReceiptFixture } from '@/lib/providers/extraction';
import { appMode, HttpError, localDataDir } from './config';
import { discardOrphanFile, storeFile, validateUpload } from './files';

export const SAMPLE_NAMES = ['clear', 'blurred', 'partial', 'large_clear'] as const;
export type SampleName = (typeof SAMPLE_NAMES)[number];
export async function demoFixtures(): Promise<DemoReceiptFixture[]> {
  try {
    return JSON.parse(await readFile(path.join(localDataDir(), 'fixtures.json'), 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
const fixtureQueue = globalThis as unknown as { carryFixtureWrite?: Promise<void> };
async function registerFixture(fixture: DemoReceiptFixture) {
  const task = (fixtureQueue.carryFixtureWrite ?? Promise.resolve()).then(async () => {
    const fixtures = await demoFixtures();
    if (!fixtures.some((f) => f.sha256 === fixture.sha256)) fixtures.push(fixture);
    const destination = path.join(localDataDir(), 'fixtures.json');
    const temporary = `${destination}.${randomUUID()}`;
    await writeFile(temporary, JSON.stringify(fixtures), { mode: 0o600 });
    await rename(temporary, destination);
  });
  fixtureQueue.carryFixtureWrite = task.catch(() => {});
  return task;
}
export async function buildSample(
  sample: SampleName,
  receiptId: string,
  now = new Date(),
): Promise<{ bytes: Uint8Array; fields: ClaimInput; fixture: DemoReceiptFixture }> {
  const date = dateInZone(now.toISOString(), 'Europe/London');
  const isLarge = sample === 'blurred' || sample === 'large_clear';
  const merchant = isLarge
    ? 'Fieldwork Supplies'
    : sample === 'partial'
      ? 'Paper & Form'
      : 'Northern Rail';
  const total = isLarge ? 42000 : sample === 'partial' ? 4500 : 2380;
  const line = isLarge
    ? 'Workshop supplies'
    : sample === 'partial'
      ? 'Office stationery and personal notebook'
      : 'Return rail ticket - client workshop';
  const price = `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
  const doc = await PDFDocument.create();
  doc.setTitle('Carry synthetic receipt');
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  const page = doc.addPage([420, 540]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.19, 0.23);
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 540, color: rgb(0.98, 0.99, 0.99) });
  const text = (value: string, y: number, size = 12, strong = false) =>
    page.drawText(value, { x: 34, y, size, font: strong ? bold : regular, color: ink });
  text('SYNTHETIC DEMO / NO REAL EXPENSE', 501, 9, true);
  text(merchant, 455, 25, true);
  text('PAID RECEIPT', 426, 10);
  page.drawLine({
    start: { x: 34, y: 408 },
    end: { x: 386, y: 408 },
    thickness: 1,
    color: rgb(0.7, 0.8, 0.8),
  });
  text(`Receipt: ${receiptId}`, 380, 10);
  text(`Date: ${date}`, 358);
  text(line, 303, 11);
  text('Currency: GBP', 277);
  text(sample === 'blurred' ? 'TOTAL: [unreadable]' : `TOTAL: GBP ${price}`, 235, 20, true);
  text('Payment: PAID by personal card', 196, 11);
  if (sample === 'blurred') text('Sample of a receipt with an unreadable total.', 155, 10);
  text('Generated for testing Carry. Not a valid receipt.', 48, 9);
  const bytes = await doc.save();
  const category = isLarge || sample === 'partial' ? 'office_supplies' : 'transport';
  const purpose = isLarge
    ? 'Supplies for the studio workshop.'
    : sample === 'partial'
      ? 'Office stationery for the studio.'
      : 'Travel to the client workshop in Manchester.';
  const sources = [
    { field: 'merchant', page: 1, quote: merchant },
    { field: 'receiptNumber', page: 1, quote: `Receipt: ${receiptId}` },
    { field: 'date', page: 1, quote: `Date: ${date}` },
    { field: 'currency', page: 1, quote: 'Currency: GBP' },
    { field: 'paidEvidence', page: 1, quote: 'Payment: PAID by personal card' },
    { field: 'category', page: 1, quote: line },
    ...(sample === 'blurred'
      ? []
      : [{ field: 'totalMinor', page: 1, quote: `TOTAL: GBP ${price}` }]),
  ];
  const extraction: Omit<Extraction, 'sources'> = {
    merchant,
    receiptNumber: receiptId,
    date,
    currency: 'GBP',
    category,
    totalMinor: sample === 'blurred' ? null : total,
    items: [{ description: line, amountMinor: sample === 'blurred' ? null : total }],
    issues: sample === 'blurred' ? ['The receipt total is unreadable. Upload a clearer copy.'] : [],
    paidEvidence: true,
    purposeMatches: true,
    provider: 'demo',
    model: 'synthetic-fixture',
    status: 'complete',
  };
  return {
    bytes,
    fixture: {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      expectedPurpose: purpose,
      extraction: { ...extraction, sources },
    },
    fields: {
      merchant,
      date,
      amountMinor: sample === 'partial' ? 3000 : total,
      currency: 'GBP',
      category,
      purpose,
      paymentNote: 'Paid by personal card, as shown on the receipt.',
      partialExplanation:
        sample === 'partial'
          ? 'Claiming GBP 30.00 of office stationery; the GBP 15.00 personal notebook is excluded.'
          : '',
      fieldsConfirmed: false,
      paidConfirmed: false,
    },
  };
}
export async function applySample(
  service: ReimbursementService,
  actor: string,
  id: string,
  expectedVersion: number,
  sample: SampleName,
) {
  if (appMode() !== 'demo')
    throw new HttpError(404, 'NOT_FOUND', 'Sample receipts are available only in the local demo.');
  const generated = await buildSample(sample, `${id}-SAMPLE`);
  let claim = await service.updateDraft(actor, id, expectedVersion, generated.fields);
  for (const attachment of claim.attachments)
    claim = await service.removeAttachment(actor, id, claim.version, attachment.id);
  const metadata = await validateUpload(generated.bytes, `${sample}-sample.pdf`);
  const stored = await storeFile(claim.organizationId, id, generated.bytes, metadata);
  try {
    claim = await service.addAttachment(actor, id, claim.version, stored);
  } catch (error) {
    await discardOrphanFile(stored.storageKey);
    throw error;
  }
  await registerFixture(generated.fixture);
  const job = await service.startExtraction(actor, id, claim.version);
  const attachment = claim.attachments.at(-1)!;
  const extraction = await getReceiptProvider({
    mode: 'demo',
    fixtures: [generated.fixture],
  }).extract({
    attachments: [
      {
        id: attachment.id,
        name: attachment.name,
        mediaType: attachment.mediaType,
        pages: attachment.pages,
        bytes: generated.bytes,
      },
    ],
    purpose: claim.purpose,
  });
  return service.saveExtraction(actor, id, claim.version, extraction, job.jobId);
}
