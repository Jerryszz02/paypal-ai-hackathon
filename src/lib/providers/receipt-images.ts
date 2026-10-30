import 'server-only';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib';
import sharp from 'sharp';
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist';
import { validateUpload } from '../server/files';
import { ProviderError, type ReceiptRequest } from './types';

const MAX_SIDE = 2400;
const MAX_PAGE_PIXELS = 4_000_000;
const MAX_TOTAL_PIXELS = 28_000_000;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_SOURCE_IMAGE_PIXELS = 16_000_000;
const MAX_PDF_IMAGE_PIXELS = 32_000_000;
const MAX_CANVAS_PIXELS = 48_000_000;
const PREPARATION_TIMEOUT_MS = 15_000;
const require = createRequire(import.meta.url);
const pdfjsRoot = path.dirname(
  require.resolve(/* webpackIgnore: true */ 'pdfjs-dist/package.json'),
);

export interface ReceiptImage {
  attachmentId: string;
  page: number;
  bytes: Uint8Array;
}

function invalidDocument(): ProviderError {
  return new ProviderError(
    'DOCUMENT_PREPARATION_FAILED',
    'The complete receipt could not be prepared safely. Review it manually.',
  );
}

function imageSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    throw invalidDocument();
  // Reject extreme PDF page boxes instead of turning them into unreadable thumbnails.
  if (width > 40_000 || height > 40_000) throw invalidDocument();
  const scale = Math.min(
    2,
    MAX_SIDE / width,
    MAX_SIDE / height,
    Math.sqrt(MAX_PAGE_PIXELS / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
  };
}

/** Only bundled font/CMap assets may be read. A PDF never supplies a URL or filesystem path. */
class LocalBinaryDataFactory {
  async fetch({ kind, filename }: { kind: string; filename: string }) {
    const directory =
      kind === 'cMapUrl'
        ? 'cmaps'
        : kind === 'standardFontDataUrl'
          ? 'standard_fonts'
          : null;
    if (!directory || !/^[A-Za-z0-9_-]+\.(bcmap|ttf|pfb)$/.test(filename))
      throw invalidDocument();
    return new Uint8Array(
      await readFile(path.join(pdfjsRoot, directory, filename)),
    );
  }
}

async function checkPdfForRasterization(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const appearanceNeedsReview = () => {
    throw new ProviderError(
      'PDF_APPEARANCE_REQUIRES_REVIEW',
      'Receipt annotations or form fields require manual review.',
    );
  };
  const form = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  if (
    form &&
    ((form.lookupMaybe(PDFName.of('Fields'), PDFArray)?.size() ?? 0) > 0 ||
      form.has(PDFName.of('XFA')))
  )
    appearanceNeedsReview();
  for (const page of pdf.getPages()) {
    const annotations = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
    for (const reference of annotations?.asArray() ?? []) {
      const annotation = pdf.context.lookup(reference, PDFDict);
      // annotationMode: 0 intentionally omits appearances and interactive forms.
      // Only ordinary links without an appearance are safe to omit from receipt pixels.
      if (
        annotation.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText() !==
          'Link' ||
        annotation.has(PDFName.of('AP'))
      )
        appearanceNeedsReview();
    }
  }
  let totalImagePixels = 0;
  // Every indirect stream appears once, including images reached through nested Forms
  // and soft masks. Reusing one image reference on multiple pages does not recount it.
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (
      !(object instanceof PDFRawStream) ||
      object.dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText() !==
        'Image'
    )
      continue;
    const width =
      object.dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() ?? 0;
    const height =
      object.dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() ?? 0;
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 8192 ||
      height > 8192 ||
      width * height > MAX_SOURCE_IMAGE_PIXELS
    )
      throw invalidDocument();
    totalImagePixels += width * height;
    if (totalImagePixels > MAX_PDF_IMAGE_PIXELS)
      throw new ProviderError(
        'DOCUMENT_LIMIT',
        'Embedded PDF images exceed recognition limits.',
      );
    const filters = pdf.context.lookup(object.dict.get(PDFName.of('Filter')));
    const names =
      filters instanceof PDFArray
        ? filters.asArray().map((item) => pdf.context.lookup(item))
        : [filters];
    // These formats need optional PDF decoders; do not silently omit their image from a receipt.
    if (
      names.some(
        (filter) =>
          filter instanceof PDFName &&
          ['JPXDecode', 'JBIG2Decode'].includes(filter.decodeText()),
      )
    )
      throw invalidDocument();
  }
}

/** Cap all intermediate canvases too, and release native allocations on every exit. */
class BoundedCanvasFactory {
  private readonly canvases = new Map<Canvas, number>();
  private allocatedPixels = 0;
  private check(width: number, height: number, previousPixels = 0) {
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 1 ||
      height < 1 ||
      width > 8192 ||
      height > 8192 ||
      width * height > MAX_SOURCE_IMAGE_PIXELS ||
      this.allocatedPixels - previousPixels + width * height > MAX_CANVAS_PIXELS
    )
      throw invalidDocument();
  }
  create(width: number, height: number) {
    this.check(width, height);
    const canvas = createCanvas(width, height);
    this.canvases.set(canvas, width * height);
    this.allocatedPixels += width * height;
    return { canvas, context: canvas.getContext('2d') };
  }
  reset(target: { canvas: Canvas }, width: number, height: number) {
    const previousPixels = this.canvases.get(target.canvas) ?? 0;
    this.check(width, height, previousPixels);
    target.canvas.width = width;
    target.canvas.height = height;
    this.canvases.set(target.canvas, width * height);
    this.allocatedPixels += width * height - previousPixels;
  }
  destroy(target: { canvas: Canvas | null; context: unknown }) {
    if (target.canvas) {
      target.canvas.width = target.canvas.height = 0;
      this.allocatedPixels -= this.canvases.get(target.canvas) ?? 0;
      this.canvases.delete(target.canvas);
    }
    target.canvas = null;
    target.context = null;
  }
  release() {
    for (const canvas of this.canvases.keys()) canvas.width = canvas.height = 0;
    this.canvases.clear();
    this.allocatedPixels = 0;
  }
}

/** Complete, local-only conversion; no partly rendered document is ever sent to a model. */
export async function prepareDeepSeekImages(
  request: ReceiptRequest,
  timeoutMs = PREPARATION_TIMEOUT_MS,
): Promise<ReceiptImage[]> {
  let loadingTask: PDFDocumentLoadingTask | undefined;
  let renderTask: RenderTask | undefined;
  let timedOut = false;
  const deadline = Date.now() + timeoutMs;
  const checkDeadline = () => {
    if (timedOut || Date.now() >= deadline)
      throw new ProviderError(
        'DOCUMENT_PREPARATION_TIMEOUT',
        'Receipt preparation timed out.',
      );
  };
  const canvases = new BoundedCanvasFactory();
  const images: ReceiptImage[] = [];
  let totalPixels = 0;
  let totalBytes = 0;
  const addImage = (image: ReceiptImage, width: number, height: number) => {
    checkDeadline();
    totalPixels += width * height;
    totalBytes += image.bytes.byteLength;
    if (
      width > MAX_SIDE ||
      height > MAX_SIDE ||
      width * height > MAX_PAGE_PIXELS ||
      totalPixels > MAX_TOTAL_PIXELS ||
      totalBytes > MAX_IMAGE_BYTES
    )
      throw new ProviderError(
        'DOCUMENT_LIMIT',
        'The prepared receipts exceed recognition limits.',
      );
    images.push(image);
  };
  let clearTimer = () => {};
  const timeout = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      timedOut = true;
      renderTask?.cancel();
      void loadingTask?.destroy().catch(() => undefined);
      reject(
        new ProviderError(
          'DOCUMENT_PREPARATION_TIMEOUT',
          'Receipt preparation timed out.',
        ),
      );
    }, timeoutMs);
    // Cleared after both success and failure, including failures before PDF loading.
    clearTimer = () => clearTimeout(timer);
  });
  // Start on the next microtask so the timeout cleanup callback is initialized first.
  const prepare = Promise.resolve().then(async () => {
    for (const document of request.attachments) {
      checkDeadline();
      const actual = await validateUpload(document.bytes, document.name);
      if (
        actual.mediaType !== document.mediaType ||
        actual.pages !== document.pages
      )
        throw invalidDocument();
      if (document.mediaType !== 'application/pdf') {
        const metadata = await sharp(document.bytes, {
          limitInputPixels: 40_000_000,
        }).metadata();
        // Rotation changes dimensions; toBuffer's decoded output dimensions are checked below.
        const { data, info } = await sharp(document.bytes, {
          limitInputPixels: 40_000_000,
        })
          .rotate()
          .resize({
            width: MAX_SIDE,
            height: MAX_SIDE,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .png()
          .timeout({ seconds: 10 })
          .toBuffer({ resolveWithObject: true });
        if (!metadata.width || !metadata.height) throw invalidDocument();
        // A square image can exceed the area cap even within the side limit.
        if (info.width * info.height > MAX_PAGE_PIXELS) {
          const { width, height } = imageSize(info.width, info.height);
          const resized = await sharp(data)
            .resize(width, height)
            .png()
            .timeout({ seconds: 10 })
            .toBuffer();
          addImage(
            { attachmentId: document.id, page: 1, bytes: resized },
            width,
            height,
          );
        } else
          addImage(
            { attachmentId: document.id, page: 1, bytes: data },
            info.width,
            info.height,
          );
        continue;
      }
      await checkPdfForRasterization(document.bytes);
      const pdfjs = await import(
        /* webpackIgnore: true */ 'pdfjs-dist/legacy/build/pdf.mjs'
      );
      checkDeadline();
      loadingTask = pdfjs.getDocument({
        data: new Uint8Array(document.bytes),
        CanvasFactory: class {
          constructor() {
            return canvases;
          }
        },
        BinaryDataFactory: LocalBinaryDataFactory,
        cMapUrl: path.join(pdfjsRoot, 'cmaps') + path.sep,
        cMapPacked: true,
        standardFontDataUrl: path.join(pdfjsRoot, 'standard_fonts') + path.sep,
        useWorkerFetch: false,
        useWasm: false,
        useSystemFonts: false,
        disableFontFace: true,
        enableXfa: false,
        stopAtErrors: true,
        maxImageSize: MAX_SOURCE_IMAGE_PIXELS,
        canvasMaxAreaInBytes: MAX_PAGE_PIXELS * 4,
        isOffscreenCanvasSupported: false,
        isImageDecoderSupported: false,
        disableAutoFetch: true,
        disableRange: true,
        disableStream: true,
      });
      try {
        const pdf = await loadingTask.promise;
        if (pdf.numPages !== document.pages) throw invalidDocument();
        for (let number = 1; number <= pdf.numPages; number++) {
          checkDeadline();
          const page = await pdf.getPage(number);
          const base = page.getViewport({ scale: 1 });
          const size = imageSize(base.width, base.height);
          const viewport = page.getViewport({ scale: size.scale });
          const target = canvases.create(size.width, size.height);
          try {
            renderTask = page.render({
              canvas: target.canvas as unknown as HTMLCanvasElement,
              canvasContext:
                target.context as unknown as CanvasRenderingContext2D,
              viewport,
              annotationMode: 0,
              background: '#ffffff',
            });
            renderTask.onContinue = (resume: () => void) => {
              if (timedOut || Date.now() >= deadline) renderTask?.cancel();
              else setImmediate(resume);
            };
            await renderTask.promise;
            addImage(
              {
                attachmentId: document.id,
                page: number,
                bytes: target.canvas.toBuffer('image/png'),
              },
              size.width,
              size.height,
            );
          } finally {
            renderTask = undefined;
            page.cleanup();
            canvases.destroy(target);
          }
        }
      } finally {
        await loadingTask.destroy();
        loadingTask = undefined;
      }
    }
    return images;
  });
  try {
    return await Promise.race([prepare, timeout]);
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw invalidDocument();
  } finally {
    clearTimer();
    renderTask?.cancel();
    if (loadingTask) await loadingTask.destroy().catch(() => undefined);
    canvases.release();
  }
}
