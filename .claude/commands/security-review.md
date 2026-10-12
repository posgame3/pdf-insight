---
description: Review the current diff against the project's threat model.
---

Review `git diff main...HEAD` against docs/threat-model.md. Check in particular: secrets in code or history,
document content in logs, user or model text rendered as HTML, CORS/rate-limit/size-limit changes in
worker/src, new network destinations (CSP in web/vite.config.ts), and whether model output is still validated
with Zod before use. Report findings by severity with file:line; say "no findings" if there are none.
