---
name: Historical collection reporting sources
description: How to avoid mixing two overlapping historical sandwich datasets
---

For reports intended to reflect the current collection log, use non-deleted production collection records consistently; do not combine their totals with the overlapping historical weekly import. The two sources disagree on some historical peak weeks, and a legacy group bucket in the weekly import is not a separate current collection-log entry.

**Why:** A supplied report used figures from the older weekly import while treating them as current collection-log totals, making the claimed all-time peak and monthly story conflict with the production collection records.

## Giving Tuesday reporting

Giving Tuesday is a reporting and fundraising date, not a deadline to reach 500,000 sandwiches.

**Why:** The user explicitly clarified that the organization does not need to reach 500,000 by Giving Tuesday; introducing that threshold misrepresents the purpose of the projection.

**How to apply:** Compare projected contributions with the total by the previous year's actual Giving Tuesday date, which shifts annually. Do not introduce a 500,000-by-Giving-Tuesday target unless requested.

**How to apply:** Name the source and counting rules in every historical report. If a user wants the historical import specifically, report it separately and explain conflicts rather than silently substituting figures. For collection records, count individual sandwiches plus either JSON group counts or legacy group columns, never both; include string-encoded JSON groups.