import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { appMode, HttpError, localDataDir, requiredEnv } from './config';
import type { AttachmentInput } from '@/lib/types';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export async function validateUpload(
  bytes: Uint8Array,
  name: string,
): Promise<Omit<AttachmentInput, 'storageKey'>> {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new HttpError(400, 'FILE_SIZE', 'Use a nonempty receipt up to 10 MB.');
  const buffer = Buffer.from(bytes);
  let mediaType: AttachmentInput['mediaType'];
  let pages = 1;
  if (buffer.subarray(0, 5).toString() === '%PDF-') {
    mediaType = 'application/pdf';
    try {
      const pdf = await PDFDocument.load(bytes);
      pages = pdf.getPageCount();
      // Inspect parsed objects: raw byte matching misses compressed object streams
      // and escaped PDF names. Receipts do not need actions or embedded files.
      const forbidden = new Set([
        'JavaScript',
        'JS',
        'Launch',
        'EmbeddedFile',
        'EmbeddedFiles',
        'RichMedia',
        'AA',
        'OpenAction',
        'SubmitForm',
        'ImportData',
        'GoToR',
      ]);
      const seen = new Set<unknown>();
      const inspect = (object: unknown): void => {
        if (seen.has(object)) return;
        seen.add(object);
        if (object instanceof PDFName && forbidden.has(object.decodeText()))
          throw new Error('Active PDF');
        if (object instanceof PDFDict)
          for (const [key, value] of object.entries()) {
            inspect(key);
            inspect(value);
          }
        if (object instanceof PDFArray)
          for (let i = 0; i < object.size(); i++) inspect(object.get(i));
      };
      for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
      if (pages < 1 || pages > 5) throw new Error('Page count');
    } catch {
      throw new HttpError(
        400,
        'PDF_INVALID',
        'Use an unencrypted PDF with 1–5 pages, without embedded scripts or files.',
      );
    }
  } else {
    try {
      const metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
      if (!metadata.width || !metadata.height || !['png', 'jpeg'].includes(metadata.format || ''))
        throw new Error('Type');
      // Decode once so truncated files do not reach the model under a trusted MIME type.
      await sharp(buffer, { limitInputPixels: 40_000_000 }).stats();
      mediaType = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
    } catch {
      throw new HttpError(
        400,
        'FILE_TYPE',
        'Upload a valid JPEG, PNG, or PDF receipt (images up to 40 megapixels).',
      );
    }
  }
  return {
    name:
      path
        .basename(name)
        .replace(/[\x00-\x1f]/g, '')
        .slice(0, 180) || 'receipt',
    mediaType,
    size: bytes.length,
    pages,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}
function storageClient() {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
function localPath(key: string) {
  if (!/^[a-zA-Z0-9_/-]+\.(pdf|png|jpg)$/.test(key) || key.includes('..'))
    throw new Error('Invalid storage key');
  return path.join(localDataDir(), 'receipts', key);
}
export async function storeFile(
  organizationId: string,
  claimId: string,
  bytes: Uint8Array,
  metadata: Omit<AttachmentInput, 'storageKey'>,
): Promise<AttachmentInput> {
  const extension =
    metadata.mediaType === 'application/pdf'
      ? 'pdf'
      : metadata.mediaType === 'image/png'
        ? 'png'
        : 'jpg';
  const key = `${organizationId}/${claimId}/${randomUUID()}.${extension}`;
  if (appMode() === 'demo') {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
  } else {
    const { error } = await storageClient()
      .storage.from('receipts')
      .upload(key, bytes, { contentType: metadata.mediaType, upsert: false });
    if (error)
      throw new HttpError(
        503,
        'UPLOAD_FAILED',
        'Receipt storage is unavailable. Try the upload again.',
      );
  }
  return { ...metadata, storageKey: key };
}
/** Call only with a storage key obtained after service.getAttachment's ownership check. */
export async function readStoredFile(key: string) {
  if (appMode() === 'demo') return new Uint8Array(await readFile(localPath(key)));
  const { data, error } = await storageClient().storage.from('receipts').download(key);
  if (error || !data)
    throw new HttpError(503, 'PREVIEW_FAILED', 'The receipt could not be loaded. Try again.');
  return new Uint8Array(await data.arrayBuffer());
}
/** Only compensates a newly created orphan after a failed metadata transaction. */
export async function discardOrphanFile(key: string) {
  if (appMode() === 'demo') await unlink(localPath(key));
  else {
    const { error } = await storageClient().storage.from('receipts').remove([key]);
    if (error) throw new Error('Orphan cleanup failed');
  }
}
