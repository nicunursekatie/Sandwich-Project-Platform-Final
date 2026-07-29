---
name: Planning sheet write attribution
description: How to find out what wrote rows to the Google planning sheet when someone reports unexpected rows
---

# Planning sheet write attribution

Only two code paths can create/update rows in the planning sheet, both user-initiated with a preview+confirm dialog:
1. The manual "Add/Push to Planning Sheet" button on scheduled event cards (exists since Jan 2026, in steady team use since Feb — ~1–4 pushes/day).
2. Approving a planning-sheet proposal (rarely used; proposals mostly sit pending).

Everything else is read-only against that sheet: the review-first import tool only reads, and the background sync is from-sheets only (the to-sheets direction is hard-disabled with an explicit "DISABLED to prevent data loss" stub).

**How to attribute a sheet write:** every successful push stamps `added_to_official_sheet_at` (UTC) on the event row. Query recent timestamps there first — it gives the exact event, org name, and time of each sheet write. Check proposal `applied_at` for the second path.

**Why:** After the import feature shipped, new sheet rows were blamed on it; the timestamps proved they were routine manual pushes by the team. Checking this column first avoids a false-alarm investigation.

**Gotcha:** the prod deployment log only covers the last ~hour, so absence of push logs there proves nothing — use the DB timestamps.
