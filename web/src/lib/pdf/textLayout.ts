/** A text run from the PDF in page units: x/y is the baseline origin, y grows upwards. */
export interface PositionedText {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  hasEOL: boolean;
}

export interface TextLine {
  text: string;
  /** Baseline in page units, measured from the bottom edge. */
  y: number;
}

const FOOTNOTE_MARKER = /^\s*(?:\d{1,2}|[*†‡])\s*$/u;

function startsNewLine(line: readonly PositionedText[], item: PositionedText): boolean {
  const anchor = line[0];
  if (!anchor) return false;
  return Math.abs(item.y - anchor.y) > Math.max(anchor.fontSize, item.fontSize) * 0.6;
}

function dominantFontSize(parts: readonly PositionedText[]): number {
  let best = { size: 0, chars: -1 };
  const charsBySize = new Map<number, number>();
  for (const part of parts) {
    const size = Math.round(part.fontSize * 10) / 10;
    const chars = (charsBySize.get(size) ?? 0) + part.text.length;
    charsBySize.set(size, chars);
    if (chars > best.chars) best = { size, chars };
  }
  return best.size;
}

/**
 * Joins runs into a line. Gaps wider than a fifth of the font size become spaces, and small raised digits
 * become "[1]", so a footnote reference no longer glues onto the word ("miesiącach1" → "miesiącach [1]").
 */
function joinLine(parts: readonly PositionedText[]): TextLine {
  const fontSize = dominantFontSize(parts);
  const baseline = parts.find((part) => Math.abs(part.fontSize - fontSize) < 0.5)?.y ?? parts[0]?.y ?? 0;
  let text = '';
  let previous: PositionedText | undefined;
  for (const part of parts) {
    if (part.text === '') continue;
    const isFootnote =
      FOOTNOTE_MARKER.test(part.text) && part.fontSize < fontSize * 0.85 && part.y > baseline + fontSize * 0.15;
    const piece = isFootnote ? `[${part.text.trim()}]` : part.text;
    const gap = previous ? part.x - (previous.x + previous.width) : 0;
    const needsSpace = previous !== undefined && (isFootnote || gap > fontSize * 0.2 || gap < -fontSize);
    if (needsSpace && !text.endsWith(' ') && !piece.startsWith(' ')) text += ' ';
    text += piece;
    previous = part;
  }
  return { text: text.trim(), y: baseline };
}

/** Groups text runs (in content-stream order, as pdf.js returns them) into visual lines. */
export function buildLines(items: readonly PositionedText[]): TextLine[] {
  const lines: TextLine[] = [];
  let current: PositionedText[] = [];
  const flush = () => {
    const line = joinLine(current);
    if (line.text !== '') lines.push(line);
    current = [];
  };
  for (const item of items) {
    if (startsNewLine(current, item)) flush();
    current.push(item);
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}
