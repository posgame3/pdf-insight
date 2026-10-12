import {
  LIMITS,
  normalizeText,
  type ExtractionReport,
  type HiddenText,
  type PageText,
  type Scan,
} from '@pdf-insight/shared';
import { AnnotationMode, Util, type PDFPageProxy, type PageViewport } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { loadPdf } from './pdfjs';
import { removeRepeatedMargins, type PageLines } from './repeatedLines';
import { encodeScan } from './scanImage';
import { buildLines, type PositionedText } from './textLayout';
import { inkRatio, isTextVisible, type PixelBuffer, type Rect } from './visibility';

export interface ExtractedDocument {
  pageCount: number;
  pages: PageText[];
  scans: Scan[];
  report: ExtractionReport;
}

export interface ExtractionProgress {
  page: number;
  total: number;
}

/**
 * A page whose body (margins excluded, so running headers and footers do not count) has less text than this,
 * but visible content, is treated as a scan or an image of text and sent to the model as a picture.
 */
const SCAN_MAX_BODY_CHARS = 80;
const BODY_AREA = { top: 0.08, bottom: 0.92 };
const SCAN_MIN_INK = 0.01;
const HIDDEN_EXCERPT_CHARS = 160;

interface PageAnalysis {
  lines: PageLines['lines'];
  hiddenText: string;
  isScan: boolean;
}

function checkScale(pageCount: number): number {
  return pageCount > 40 ? 1 : 1.5;
}

/**
 * Axis-aligned box of a text run on the rendered canvas, from just below the baseline to the cap height.
 * Works for rotated text too, so rotating hidden text does not slip it past the check.
 */
function deviceRect(item: TextItem, viewport: PageViewport): Rect {
  const [a, b, c, d, e, f] = Util.transform(viewport.transform, item.transform) as number[] as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const height = Math.hypot(c, d);
  const length = item.width * viewport.scale;
  const angle = Math.atan2(b, a);
  const along = { x: Math.cos(angle), y: Math.sin(angle) };
  const up = { x: along.y, y: -along.x };
  const corners = [0, 1].flatMap((t) =>
    [-0.15, 0.8].map((s) => ({
      x: e + along.x * t * length + up.x * s * height,
      y: f + along.y * t * length + up.y * s * height,
    })),
  );
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

function toPositioned(item: TextItem): PositionedText {
  const [, , c = 0, d = 0, x = 0, y = 0] = item.transform as number[];
  return { text: item.str, x, y, width: item.width, fontSize: Math.hypot(c, d), hasEOL: item.hasEOL };
}

async function renderPage(page: PDFPageProxy, canvas: HTMLCanvasElement, scale: number): Promise<PixelBuffer> {
  const viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas 2D context is unavailable');
  await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.DISABLE }).promise;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, width: image.width, height: image.height };
}

async function analysePage(page: PDFPageProxy, canvas: HTMLCanvasElement, scale: number): Promise<PageAnalysis> {
  const viewport = page.getViewport({ scale });
  const pixels = await renderPage(page, canvas, scale);
  const content = await page.getTextContent();
  const pageHeight = page.getViewport({ scale: 1 }).height;

  const visible: PositionedText[] = [];
  const hidden: PositionedText[] = [];
  for (const item of content.items) {
    if (!('str' in item)) continue;
    const positioned = toPositioned(item);
    if (item.str.trim() === '' || isTextVisible(pixels, deviceRect(item, viewport), positioned.fontSize)) {
      visible.push(positioned);
    } else {
      hidden.push(positioned);
    }
  }

  const lines = buildLines(visible).map((line) => ({ text: line.text, position: 1 - line.y / pageHeight }));
  const bodyChars = lines
    .filter((line) => line.position > BODY_AREA.top && line.position < BODY_AREA.bottom)
    .reduce((sum, line) => sum + line.text.replace(/\s/g, '').length, 0);
  return {
    lines,
    hiddenText: normalizeText(
      buildLines(hidden)
        .map((line) => line.text)
        .join(' '),
    ),
    isScan: bodyChars < SCAN_MAX_BODY_CHARS && inkRatio(pixels) > SCAN_MIN_INK,
  };
}

/**
 * Reads a PDF entirely in the browser: visible text per page, hidden text (reported, never sent), and
 * scanned pages rendered to JPEG for the model to read.
 */
export async function extractDocument(
  data: ArrayBuffer,
  options: { signal: AbortSignal; onProgress: (progress: ExtractionProgress) => void },
): Promise<ExtractedDocument> {
  const task = loadPdf(new Uint8Array(data));
  const cancel = () => void task.destroy();
  options.signal.addEventListener('abort', cancel, { once: true });
  try {
    const pdf = await task.promise;
    const total = Math.min(pdf.numPages, LIMITS.maxPages);
    const scale = checkScale(total);
    const canvas = document.createElement('canvas');
    const pageLines: PageLines[] = [];
    const scans: Scan[] = [];
    const hiddenText: HiddenText[] = [];
    const scannedPages: number[] = [];
    const unreadPages = Array.from({ length: pdf.numPages - total }, (_, index) => total + index + 1);

    for (let number = 1; number <= total; number += 1) {
      options.signal.throwIfAborted();
      options.onProgress({ page: number, total });
      const page = await pdf.getPage(number);
      try {
        const analysis = await analysePage(page, canvas, scale);
        pageLines.push({ page: number, lines: analysis.lines });
        if (analysis.hiddenText !== '') {
          hiddenText.push({
            page: number,
            chars: analysis.hiddenText.length,
            excerpt: analysis.hiddenText.slice(0, HIDDEN_EXCERPT_CHARS),
          });
        }
        if (analysis.isScan) {
          scannedPages.push(number);
          if (scans.length < LIMITS.maxScanImages) scans.push(await encodeScan(page, canvas, number));
          else unreadPages.push(number);
        }
      } finally {
        page.cleanup();
      }
    }

    const pages = removeRepeatedMargins(pageLines).map(({ page, lines }) => {
      const text = normalizeText(lines.join('\n'));
      if (text.length > LIMITS.maxPageChars) unreadPages.push(page);
      return { page, text: text.slice(0, LIMITS.maxPageChars) };
    });
    return {
      pageCount: pdf.numPages,
      pages,
      scans,
      report: { scannedPages, unreadPages: [...new Set(unreadPages)].sort((a, b) => a - b), hiddenText },
    };
  } finally {
    options.signal.removeEventListener('abort', cancel);
    await task.destroy();
  }
}
