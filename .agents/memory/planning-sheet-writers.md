---
name: Planning sheet is read-only for the app
description: The app can no longer write to the Google planning sheet (removed Jul 27 2026); how to attribute historical sheet writes
---

# Planning sheet: app is READ-ONLY (owner mandate)

On Jul 27, 2026 the owner ordered removal of every app→planning-sheet write path after new sheet rows were mistakenly blamed on the (read-only) import tool. Removed: the "Push to Sheet" button on event cards, the proposals review page, all push/propose/approve endpoints, and every sheet-write method in the planning-sheet sync service. The service's Google auth scope is now `spreadsheets.readonly`, so even reintroduced write code would be rejected by Google.

**Rule:** never rebuild an app→planning-sheet write path (push, sync-to-sheet, "add to sheet" buttons) without an explicit owner request. Sheet rows are added by humans directly in Google Sheets; the app only reads.

**Why:** the owner's hard requirement — "the app should never write rows to the planning sheet."

**Historical attribution:** rows created by the app before Jul 27, 2026 came from the old push button; each push stamped `added_to_official_sheet_at` (UTC) on the event. That column plus proposal `applied_at` is the complete history — 139 pushes total, Feb–Jul 2026. The `addedToOfficialSheet` flag still exists but is now only a manual app-DB checkbox ("Manually Added to Google Sheet") with no sheet write.

**Gotchas:** prod deployment log only covers ~1 hour, so use DB timestamps, not logs. The `proposed_sheet_changes` table remains (historical data, incl. 2 old pending proposals) but no code references it.

**Apps Script backdoor (removed but not fully dead):** a pre-existing client lib once POSTed rows to a Google Apps Script web app with its API key hardcoded in client code. Removed Jul 27 2026, but the key/URL live on in git history and in the deployed bundle until republish — the owner must delete/rotate that Apps Script deployment in their Google account to fully close it. If planning-sheet rows ever appear again with no `added_to_official_sheet_at` trail, suspect that script.
