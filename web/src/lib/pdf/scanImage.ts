import { LIMITS, type Scan } from '@pdf-insight/shared';
import { AnnotationMode, type PDFPageProxy } from 'pdfjs-dist';
import { bytesToBase64 } from '../base64';

/** Longest edge Claude processes without downscaling; smaller fallbacks keep heavy scans under the size limit. */
const ATTEMPTS = [
  { longEdge: 1568, quality: 0.82 },
  { longEdge: 1280, quality: 0.7 },
  { longEdge: 1024, quality: 0.6 },
] as const;

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('JPEG encoding failed'));
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Renders a scanned page to a JPEG small enough for the API request. */
export async function encodeScan(page: PDFPageProxy, canvas: HTMLCanvasElement, pageNumber: number): Promise<Scan> {
  const base = page.getViewport({ scale: 1 });
  let data = '';
  for (const attempt of ATTEMPTS) {
    const viewport = page.getViewport({ scale: attempt.longEdge / Math.max(base.width, base.height) });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable');
    await page.render({ canvas, canvasContext: context, viewport, annotationMode: AnnotationMode.DISABLE }).promise;
    data = bytesToBase64(new Uint8Array(await (await toJpeg(canvas, attempt.quality)).arrayBuffer()));
    if (data.length <= LIMITS.maxScanImageChars) break;
  }
  return { page: pageNumber, mediaType: 'image/jpeg', data };
}
