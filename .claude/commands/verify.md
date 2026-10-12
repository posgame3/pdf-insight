---
description: Run every quality gate the CI runs, then summarise failures with file:line references.
---

Run `npm run verify` and then `npm run e2e`. If anything fails, show the failing check, the file and line, and
the smallest fix. Do not change tests to make them pass unless the test itself is wrong; say so explicitly if it is.
