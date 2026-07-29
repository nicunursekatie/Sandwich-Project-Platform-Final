---
name: Gitignored build assets break deploy
description: Why @assets imports must be tracked in git, or vite build fails on publish
---

The vite `@assets` alias points at `attached_assets/` (vite.config.ts), but `attached_assets/` is gitignored. Any image imported via `@assets/...` is a BUILD-TIME dependency — vite/rollup reads the file from disk during `vite build`. If it's not in version control:

- It exists only as a local workspace file.
- Task-agent merges (and any clean checkout / fresh environment) do NOT preserve untracked-ignored files, so the file silently disappears from the workspace.
- The next publish runs `vite build`, which fails with `[vite:asset] Could not load .../attached_assets/.../X.png: ENOENT`. The dev server shows the same problem as `[vite] Pre-transform error: Failed to resolve import "@assets/..."` and the process exits.

**Rule:** every asset imported via `@assets/...` at build time MUST be un-ignored in `.gitignore` so it stays tracked.

**Why:** assets referenced only via the `public/` folder (URL strings like `/images/...`) are fine when gitignored because they're served at runtime; but `@assets/...` ES imports are bundled at build time and must be present on disk when `vite build` runs. This bug class only surfaces at publish (or after a merge), not in normal dev once the local file exists.

**How to apply:**
- Pattern used in `.gitignore`: change the blanket `attached_assets/` ignore to `attached_assets/*`, then add explicit `!` negations — re-include the `LOGOS/` directory first, then each needed file (git cannot re-include a file whose parent dir is still excluded).
- Always verify with `git status --porcelain -uall -- attached_assets/` that ONLY the intended small files become tracked. Never un-ignore the whole dir — it holds 200MB+ of screenshots/json/pdf.
- When adding a NEW `@assets/...` import, immediately add a matching `!attached_assets/...` negation.
- Enumerate all build-time asset refs with: `rg -oN --no-filename "@assets/[^'\"]+" client/ | sort -u`.
