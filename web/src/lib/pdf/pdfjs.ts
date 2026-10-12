import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerUrl;

const assetsUrl = `${import.meta.env.BASE_URL}pdfjs/`;

/**
 * Starts loading a PDF in the pdf.js worker. All assets are served from our own origin, and nothing in the file
 * can execute: pdf.js renders without eval, XFA forms are off and document scripts are never run.
 */
export function loadPdf(data: Uint8Array): PDFDocumentLoadingTask {
  return getDocument({
    data,
    cMapUrl: `${assetsUrl}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetsUrl}standard_fonts/`,
    wasmUrl: `${assetsUrl}wasm/`,
    iccUrl: `${assetsUrl}iccs/`,
    enableXfa: false,
    stopAtErrors: false,
  });
}
