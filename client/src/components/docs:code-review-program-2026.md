# Code Review Program 2026

**Repository:** Sandwich-Project-Platform-Final  
**Start Date:** YYYY-MM-DD  
**Program Owner:** <name>  
**Status:** Active

---

## 1) Program Charter

### Goals
1. Improve correctness of previously AI-generated features.
2. Reduce maintainability debt (duplicate logic, weak typing, stale code).
3. Enforce architecture invariants and security boundaries.
4. Increase confidence via tests and type checks.

### Non-Goals
- Full product redesign
- Unscoped refactors with no measurable outcome

### Definition of Done (Program)
- [ ] All P0/P1 findings resolved or accepted with explicit risk signoff.
- [ ] Critical feature slices reviewed end-to-end.
- [ ] Regressions prevented via automated gates and PR checklist.

---

## 2) Scope & Slices

Review by vertical slice (client + server + shared + tests together).

| Order | Slice | Owner | Status | Notes |
|------:|-------|-------|--------|-------|
| 1 | Auth & Permissions |  | Not Started |  |
| 2 | Event Requests |  | Not Started |  |
| 3 | Notifications |  | Not Started |  |
| 4 | Messaging / Realtime |  | Not Started |  |
| 5 | Collections / Projects |  | Not Started |  |
| 6 | Analytics / Reporting |  | Not Started |  |

---

## 3) Review Rubric

Score each finding 1–5 in each category.

- **User Impact** (5 = severe user harm)
- **Production Risk** (5 = can cause outage/data corruption/security issue)
- **Frequency** (5 = happens often)
- **Fix Effort Inverse** (5 = very cheap to fix)
- **Architecture Drift** (5 = violates core patterns)

**Priority Score = sum(5 dimensions)**

Priority bands:
- **P0 (18–25):** Immediate
- **P1 (12–17):** Current milestone
- **P2 (7–11):** Backlog
- **P3 (≤6):** Defer/monitor

---

## 4) Findings Inventory

| ID | Slice | Location | Issue Type | Summary | Impact | Score | Priority | Owner | Status | PR |
|----|-------|----------|-----------|---------|--------|------:|----------|-------|--------|----|
| CR-001 | Event Requests | client/... | Data loss | Intake call notes not persisted | High | 20 | P0 |  | Triaged |  |
| CR-002 | Projects | server/... | Incomplete endpoint | files route returns [] | High | 18 | P0 |  | Triaged |  |

---

## 5) Per-PR Checklist (Mandatory)

### Safety
- [ ] No new `TODO`/stub logic without linked issue ID.
- [ ] No new `any` unless justified with comment + tracking ticket.
- [ ] No duplicated “v2/final/fixed/new” variants introduced.
- [ ] Architecture invariants checked (sockets/auth/contracts).

### Quality
- [ ] Type check passes.
- [ ] Relevant unit/integration tests added or updated.
- [ ] E2E coverage added for user-visible behavior changes (if applicable).
- [ ] Risky changes include rollback notes.

### Documentation
- [ ] Finding row updated with PR link.
- [ ] Slice notes updated with behavior/contract changes.

---

## 6) Operating Cadence

### Weekly
- **Mon:** Triage + plan top 5 findings
- **Tue–Thu:** Execute cleanup PRs
- **Fri:** Verification + metrics + retro

### Daily Standup Questions
1. Which findings moved status yesterday?
2. Any blocker requiring scope split or escalation?
3. Are we shipping risky fixes without tests?

---

## 7) Validation Gates (Runbook)

Run these for each cleanup branch:

```bash
npm run type-check
npm run test:unit
npm run test:integration
# if user-facing behavior changed in critical flows:
npm run test:e2e