---
name: Event lead-time data boundary
description: Defines the reliable date boundary for analyzing how far ahead event requests arrived.
---

Treat `created_at` as a request-date proxy only for records created from late August 2025 onward. Older historical event records were bulk-imported after the events occurred, producing negative and otherwise invalid lead times.

**Why:** Month-level analysis for 2023 through early 2025 showed event records created hundreds of days after their event dates. October 2025 is the first complete October with plausible request timing.

**How to apply:** Restrict lead-time comparisons to late August 2025 or later. For year-over-year October forecasting, state that only October 2025 currently provides a clean historical benchmark and avoid claiming a multi-year trend.