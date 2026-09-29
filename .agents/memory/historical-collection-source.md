---
name: Historical collection reporting sources
description: How to avoid mixing two overlapping historical sandwich datasets
---

For reports intended to reflect the current collection log, use non-deleted production collection records consistently; do not combine their totals with the overlapping historical weekly import. The two sources disagree on some historical peak weeks, and a legacy group bucket in the weekly import is not a separate current collection-log entry.

**Why:** A supplied report used figures from the older weekly import while treating them as current collection-log totals, making the claimed all-time peak and monthly story conflict with the production collection records.

**How to apply:** Name the source and counting rules in every historical report. If a user wants the historical import specifically, report it separately and explain conflicts rather than silently substituting figures. For collection records, count individual sandwiches plus either JSON group counts or legacy group columns, never both; include string-encoded JSON groups.