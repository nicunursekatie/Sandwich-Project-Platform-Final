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

## Missing weekly logs in impact estimates

For impact estimates and projections, estimate genuinely missing regional weekly logs from prior observed counts instead of implicitly treating absent reports as zero production. Keep confirmed totals and estimated additions separately labeled.

**Why:** The user explicitly requested missing-location estimates because incomplete submissions can create a misleading apparent decline and depress the forecast.

**How to apply:** Follow the regional and special-case rules in weekly-monitoring-interpretation.md. Preserve submitted counts, including explicit zeros; avoid imputing irregular group events or exempt/inactive locations. Do not write estimates into the collection database without an explicit request for that change. Apply comparable completeness adjustments before asserting year-over-year production growth or decline.

**How to apply:** Name the source and counting rules in every historical report. If a user wants the historical import specifically, report it separately and explain conflicts rather than silently substituting figures. For collection records, count individual sandwiches plus either JSON group counts or legacy group columns, never both; include string-encoded JSON groups.