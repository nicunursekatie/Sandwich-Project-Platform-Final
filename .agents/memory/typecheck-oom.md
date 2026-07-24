---
name: Type-check OOM workaround
description: How to run a full tsc type-check in this repo without it crashing
---
`npx tsc --noEmit -p tsconfig.json` crashes with a V8 out-of-memory abort on this codebase under default Node heap limits.

**Why:** the project is large (~1,800-line components, big schema files); default heap is too small, and the crash output looks like a native stack trace, not a TS error — easy to mistake for success when filtering output.

**How to apply:** run with `NODE_OPTIONS=--max-old-space-size=6144 npx tsc --noEmit -p tsconfig.json`, and always confirm the run actually completed (e.g. check total `error TS` count is nonzero — this repo has ~1,400 pre-existing errors, so a zero count means the run died). Filter to your files with rg afterwards.
