// PostToolUse hook: formats the file Claude just edited, so generated code always matches Prettier.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const filePath = JSON.parse(readFileSync(0, 'utf8')).tool_input?.file_path;
if (filePath && /\.(ts|tsx|js|mjs|json|css|md|ya?ml|html)$/.test(filePath)) {
  try {
    execFileSync('npx', ['prettier', '--write', '--ignore-unknown', filePath], { stdio: 'ignore' });
  } catch {
    // Formatting is a convenience; CI enforces it with `npm run format:check`.
  }
}
