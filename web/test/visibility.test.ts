import { describe, expect, it } from 'vitest';
import { inkRatio, isTextVisible, regionContrast, type PixelBuffer } from '../src/lib/pdf/visibility';

type Rgb = readonly [number, number, number];
const WHITE: Rgb = [255, 255, 255];
const NAVY: Rgb = [22, 58, 95];
const BLACK: Rgb = [20, 20, 20];

function canvas(width: number, height: number, paint: (x: number, y: number) => Rgb): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

const glyphs = (ink: Rgb, background: Rgb) => (x: number, y: number) =>
  x >= 10 && x < 90 && y >= 10 && y < 20 && x % 4 === 0 ? ink : background;
const textRect = { left: 8, top: 8, right: 92, bottom: 22 };

describe('text visibility', () => {
  it('treats white text on a white page as hidden', () => {
    expect(isTextVisible(canvas(100, 40, glyphs(WHITE, WHITE)), textRect, 5)).toBe(false);
  });

  it('treats near-white text on white as hidden', () => {
    expect(isTextVisible(canvas(100, 40, glyphs([246, 246, 246], WHITE)), textRect, 10)).toBe(false);
  });

  it('treats dark text on white as visible', () => {
    expect(isTextVisible(canvas(100, 40, glyphs(BLACK, WHITE)), textRect, 10)).toBe(true);
  });

  it('treats white table headers on navy as visible (no false positive)', () => {
    expect(isTextVisible(canvas(100, 40, glyphs(WHITE, NAVY)), textRect, 9)).toBe(true);
  });

  it('treats microscopic text as hidden even with contrast', () => {
    expect(isTextVisible(canvas(100, 40, glyphs(BLACK, WHITE)), textRect, 1)).toBe(false);
  });

  it('treats text placed outside the page as hidden', () => {
    const buffer = canvas(100, 40, () => WHITE);
    expect(regionContrast(buffer, { left: 200, top: 200, right: 300, bottom: 220 })).toBeNull();
    expect(isTextVisible(buffer, { left: -500, top: 10, right: -400, bottom: 20 }, 10)).toBe(false);
  });
});

describe('inkRatio', () => {
  it('is zero for a blank page', () => {
    expect(inkRatio(canvas(200, 280, () => WHITE))).toBe(0);
  });

  it('is clearly positive for a page with printed content', () => {
    const scan = canvas(200, 280, (x, y) => (y % 10 < 3 && x > 20 && x < 180 ? BLACK : [238, 236, 230]));
    expect(inkRatio(scan)).toBeGreaterThan(0.1);
  });
});
