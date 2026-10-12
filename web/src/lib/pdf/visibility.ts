export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Luminance spread (0–255) below which text cannot be read: white on white, or a near-invisible tint. */
export const MIN_VISIBLE_CONTRAST = 40;
/** Text smaller than this (in points) is unreadable even when it has contrast. */
export const MIN_READABLE_FONT_SIZE = 2.5;
const MAX_SAMPLES = 4_000;

function luminance(data: Uint8ClampedArray, offset: number): number {
  return 0.2126 * (data[offset] ?? 0) + 0.7152 * (data[offset + 1] ?? 0) + 0.0722 * (data[offset + 2] ?? 0);
}

function* samplePoints(buffer: PixelBuffer, rect: Rect): Generator<number> {
  const left = Math.max(0, Math.floor(rect.left));
  const top = Math.max(0, Math.floor(rect.top));
  const right = Math.min(buffer.width, Math.ceil(rect.right));
  const bottom = Math.min(buffer.height, Math.ceil(rect.bottom));
  const area = (right - left) * (bottom - top);
  if (right <= left || bottom <= top) return;
  const step = Math.max(1, Math.floor(Math.sqrt(area / MAX_SAMPLES)));
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) yield (y * buffer.width + x) * 4;
  }
}

/**
 * Difference between the lightest and darkest pixel in the rendered region. Rendering the page and looking
 * at the result catches every way of hiding text – white or background-coloured fill, a covering shape,
 * clipping – while white text on a dark table header correctly counts as visible.
 * Returns null when the region lies outside the page.
 */
export function regionContrast(buffer: PixelBuffer, rect: Rect): number | null {
  let min = 255;
  let max = 0;
  let sampled = false;
  for (const offset of samplePoints(buffer, rect)) {
    const value = luminance(buffer.data, offset);
    min = Math.min(min, value);
    max = Math.max(max, value);
    sampled = true;
  }
  return sampled ? max - min : null;
}

/** Share of the page that differs clearly from its dominant background colour. */
export function inkRatio(buffer: PixelBuffer): number {
  const values: number[] = [];
  for (const offset of samplePoints(buffer, { left: 0, top: 0, right: buffer.width, bottom: buffer.height })) {
    values.push(luminance(buffer.data, offset));
  }
  if (values.length === 0) return 0;
  const histogram = new Map<number, number>();
  for (const value of values) {
    const bucket = Math.round(value / 8);
    histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
  }
  const [background] = [...histogram.entries()].reduce((best, entry) => (entry[1] > best[1] ? entry : best));
  return values.filter((value) => Math.abs(value - background * 8) > 48).length / values.length;
}

export function isTextVisible(buffer: PixelBuffer, rect: Rect, fontSize: number): boolean {
  if (fontSize < MIN_READABLE_FONT_SIZE) return false;
  const contrast = regionContrast(buffer, rect);
  return contrast !== null && contrast >= MIN_VISIBLE_CONTRAST;
}
