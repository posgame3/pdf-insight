import { LIMITS } from '@pdf-insight/shared';
import { MESSAGES } from './messages';

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
/** The PDF specification allows bytes before the header; readers accept it within the first kilobyte. */
const SIGNATURE_WINDOW = 1024;

export type FileCheck = { ok: true } | { ok: false; message: string };

export function hasPdfSignature(bytes: Uint8Array): boolean {
  const last = Math.min(bytes.length, SIGNATURE_WINDOW) - PDF_SIGNATURE.length;
  for (let start = 0; start <= last; start += 1) {
    if (PDF_SIGNATURE.every((byte, index) => bytes[start + index] === byte)) return true;
  }
  return false;
}

/** Checks the file before anything is parsed: size limit and the real file signature, not the extension. */
export async function checkPdfFile(file: File): Promise<FileCheck> {
  if (file.size === 0) return { ok: false, message: MESSAGES.emptyFile };
  if (file.size > LIMITS.maxFileBytes) return { ok: false, message: MESSAGES.fileTooLarge(file.size) };
  const head = new Uint8Array(await file.slice(0, SIGNATURE_WINDOW).arrayBuffer());
  if (!hasPdfSignature(head)) return { ok: false, message: MESSAGES.notPdf };
  return { ok: true };
}
