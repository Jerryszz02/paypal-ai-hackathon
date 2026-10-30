'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileWarning, LoaderCircle } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { Attachment } from '@/lib/types';

/** Render PDF drawing operations only. Receipt JavaScript, forms and links are never mounted. */
export function PdfReceiptPreview({ attachment }: { attachment: Attachment }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    const controller = new AbortController();
    import('pdfjs-dist')
      .then(async (pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const response = await fetch(`/api/attachments/${attachment.id}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('The original is unavailable.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!active) return;
        if (bytes.byteLength > 10 * 1024 * 1024)
          throw new Error('The original exceeds the preview limit.');
        task = pdfjs.getDocument({
          data: bytes,
          useSystemFonts: true,
          enableXfa: false,
          stopAtErrors: true,
          maxImageSize: 40_000_000,
          useWasm: false,
        });
        const pdf = await task.promise;
        if (pdf.numPages > 5) {
          await task.destroy();
          throw new Error('The original exceeds the page limit.');
        }
        if (active) setDocument(pdf);
      })
      .catch(() => {
        if (active)
          setError('This PDF could not be previewed. Open the original to review its contents.');
      });
    return () => {
      active = false;
      controller.abort();
      void task?.destroy();
    };
  }, [attachment.id]);
  useEffect(() => {
    if (!document || !canvas.current) return;
    let active = true;
    let task: RenderTask | undefined;
    const target = canvas.current;
    document
      .getPage(page)
      .then((pdfPage) => {
        if (!active) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({ scale: Math.min(3, 1000 / base.width) });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        task = pdfPage.render({ canvas: target, viewport, annotationMode: 0 });
        return task.promise;
      })
      .then(() => {
        if (active) setRenderedPage(page);
      })
      .catch(() => {
        if (active) setError('This page could not be previewed. Open the original to review it.');
      });
    return () => {
      active = false;
      task?.cancel();
    };
  }, [document, page]);
  const loading = !error && (!document || renderedPage !== page);
  return (
    <div className="pdf-viewer">
      <div className="receipt-preview pdf-canvas-container" aria-busy={loading}>
        {error ? (
          <div className="pdf-preview-error" role="status">
            <FileWarning size={27} strokeWidth={1.4} />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <canvas
              ref={canvas}
              key={page}
              role="img"
              aria-label={`Original receipt ${attachment.name}, page ${page}`}
              className={loading ? 'pdf-rendering' : ''}
            />
            {loading && (
              <div className="pdf-preview-loading" role="status">
                <LoaderCircle size={20} className="spin" />
                <span>Rendering the original…</span>
              </div>
            )}
          </>
        )}
      </div>
      {document && !error && (
        <div className="pdf-page-controls">
          <button
            type="button"
            className="icon-button"
            aria-label="Previous receipt page"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span>
            Page {page} of {document.numPages}
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label="Next receipt page"
            disabled={loading || page >= document.numPages}
            onClick={() => setPage((value) => value + 1)}
          >
            <ChevronRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
