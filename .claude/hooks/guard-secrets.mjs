// PreToolUse hook: blocks writing an API key or a local secrets file. Exit code 2 rejects the edit and the
// message is shown to Claude, so a key can never be committed by accident during an AI-assisted session.
import { readFileSync } from 'node:fs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const { file_path: filePath = '', content = '', new_string: newString = '', edits = [] } = input.tool_input ?? {};
const text = [content, newString, ...edits.map((edit) => edit.new_string ?? '')].join('\n');

const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{16,}/,
  /\bsk-[A-Za-z0-9]{32,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
if (/(^|\/)(\.dev\.vars|\.env)$/.test(filePath)) {
  console.error(`Blocked: ${filePath} holds local secrets. Edit it yourself; it is git-ignored.`);
  process.exit(2);
}
if (SECRET_PATTERNS.some((pattern) => pattern.test(text))) {
  console.error('Blocked: the change contains something that looks like a secret key. Use `wrangler secret put`.');
  process.exit(2);
}
