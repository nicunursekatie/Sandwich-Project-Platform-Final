---
name: Production DB connectivity (Neon transient outages)
description: When a production page/component "stalls / fails to load", check Neon DB reachability in deployment logs BEFORE suspecting the component's code.
---

# Symptom → cause

User reports a page/component (e.g. the events view) "stalling out / failing to load" in the published app, often with a scary browser console dump.

**First move: pull deployment logs and look for Neon database connectivity errors — not the component code.** When the DB is unreachable, every data request hangs, so the page spins forever even though nothing is wrong with that page.

## Server-side signatures of a Neon outage/blip
- `Error connecting to database: fetch failed`
- `Client network socket disconnected before secure TLS connection was established`
- `read ECONNRESET`
- `terminating connection due to administrator command` (Postgres 57P01 admin_shutdown = Neon compute suspend/restart/maintenance/autoscale)
- `NeonDbError` / "Failed to count active users" / "Failed to prune sessions" / "Error cleaning up expired locks"

## Two DB paths (different failure modes)
- App queries → Neon **HTTP** driver (drizzle + @neondatabase/serverless). Failure shows as "fetch failed" / NeonDbError.
- Session store → `connect-pg-simple` over a node-postgres **TCP pool**. This is the *more fragile* path (Neon drops idle TCP conns); shows ECONNRESET / TLS-disconnect on `/api/users/heartbeat`.
- If BOTH HTTP and TCP fail in the same window → it's a Neon-side availability event, not just a stale pool.

## Browser-console red herrings during such an outage
- `[App] Authentication error: TypeError: Failed to fetch` (backend couldn't reach DB to auth).
- CSP `connect-src` violations — usually just Google Analytics (`www.google.com/g/collect`, `region1.google-analytics.com`) being denied; not the cause of stalling.
- socket.io `ERR_NAME_NOT_RESOLVED` / `ERR_NETWORK_CHANGED` — these two specifically mean the **client's own network** dropped/changed mid-session (socket connects to `window.location.origin`), not a server bug.

## Disposition
- These incidents are usually **transient and self-recover**. Confirm recovery by log silence (no new DB errors) + resumed normal endpoint traffic, then have the user reload.
- Only consider code work if it recurs: graceful error/retry UI instead of an infinite spinner, and/or hardening the session-store TCP pool (the chronic low-grade source of heartbeat 500s).
