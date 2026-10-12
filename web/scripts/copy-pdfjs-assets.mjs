// Copies the pdf.js runtime assets (CMaps, standard fonts, image-decoder WASM) into public/pdfjs so they are
// served from our own origin. The JavaScript scripting engine (quickjs) is deliberately left out: PDF scripts
// are never executed.
import { cpSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pdfjsRoot = dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json'));
const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'pdfjs');

rmSync(target, { recursive: true, force: true });
for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  cpSync(join(pdfjsRoot, directory), join(target, directory), {
    recursive: true,
    filter: (source) => !/quickjs/i.test(source),
  });
}
