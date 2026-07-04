/**
 * Event Request — shared PATCH (partial-update) contract.
 *
 * ONE validation contract for partial updates to an event request, derived from
 * `insertEventRequestSchema` so it tracks the `eventRequests` table automatically
 * — there is no hand-maintained column allowlist to drift out of sync. Every
 * field is optional: a PATCH sends only the fields that actually changed.
 *
 * STATUS: introduced in SHADOW MODE (PR-A of the save-path consolidation, see
 * docs/event-request-save-path-consolidation.md). The server PATCH handler parses
 * the request body against this schema and LOGS any violations WITHOUT rejecting,
 * so the contract can be tightened against real production traffic before it is
 * ever allowed to block a save. Field-level coercions (dates, refrigeration
 * boolean, needs counts, sandwich-type JSON) and the enforced 400-on-invalid
 * behavior are folded in during later PRs.
 */
import { z } from 'zod';
import { insertEventRequestSchema } from './schema';

/**
 * Partial event-request update. Derived from the create schema so every real
 * column is covered; `.partial()` makes them all optional for PATCH semantics.
 * Unknown keys are stripped (Zod's default object behavior), matching how the
 * storage layer ignores non-column keys.
 */
export const eventRequestPatchSchema = insertEventRequestSchema.partial();

export type EventRequestPatch = z.infer<typeof eventRequestPatchSchema>;
