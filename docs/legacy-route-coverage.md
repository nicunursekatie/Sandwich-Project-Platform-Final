# Legacy Route Coverage Verification

To replace the monolithic route files (`temp_clean_routes.ts`, `temp_routes_clean.ts`, and `server/routes_backup.ts`), the modular router in `server/routes/index.ts` now mounts feature-specific routers. The tables below capture the legacy API areas and the modules that currently serve the same endpoints.

## Core and Authentication
| Legacy functionality | Modular replacement |
| --- | --- |
| Session/auth debugging endpoints (`/api/debug/session`, `/api/debug/auth-status`) | `createAdminRoutes` mounts `/debug/session` and `/debug/auth-status`, keeping the same paths after the `/api` prefix is applied.【F:server/routes/admin.ts†L210-L277】 |
| Legacy login/logout/session management (`/api/auth/*`) | `createAuthRoutes` handles `/login`, `/logout`, and `/user`, preserving the `temp_*` behavior inside `/api/auth` once mounted.【F:server/routes/auth.ts†L10-L203】 |

## Projects, Tasks, and Files
| Legacy functionality | Modular replacement |
| --- | --- |
| Project CRUD, claiming, archiving, file/task sub-routes | `createProjectRoutes` exposes project listing, creation, updates, deletion, archive actions, nested task management, and file uploads when mounted at `/api/projects`【F:server/routes/projects/index.ts†L52-L455】 |
| Task completion history, status changes, deletion | `tasksRouter` retains completion endpoints (`/:taskId/complete`), completion reversal, list retrieval, and task deletion/updates under `/api/tasks`.【F:server/routes/tasks/index.ts†L41-L247】 |

## Collections and Data Integrity
| Legacy functionality | Modular replacement |
| --- | --- |
| Sandwich collection stats, CRUD, deduplication tools | `collectionsRouter` offers stats, pagination, creation, corruption fixes, bulk deletion, duplicate analysis, and single-item deletes at `/api/sandwich-collections`.【F:server/routes/collections/index.ts†L17-L431】 |
| Bulk integrity utilities (collection exports, data fixes, backups) | `dataManagementRouter` centralizes exports, deduplication, bulk deletions, integrity checks, and backup tooling under `/api/data-management` to replace the monolithic backup endpoints.【F:server/routes/data-management.ts†L19-L146】 |

## Meetings and Agenda Management
| Legacy functionality | Modular replacement |
| --- | --- |
| Meeting minutes, drive links, file downloads, meeting CRUD | `meetingsRouter` now serves minutes, uploads, meeting CRUD, and related utilities under the `/api/meetings*` mount points defined in `server/routes/index.ts` (including `/meeting-minutes`, `/current-meeting`, and `/files`).【F:server/routes/meetings/index.ts†L88-L188】 |
| Agenda item listing, creation, updates, and deletion | `createAgendaItemsRouter` continues providing the agenda item endpoints consumed by the legacy app once mounted at `/api/agenda-items`.【F:server/routes/agenda-items.ts†L10-L160】 |

## Operational Directories
| Legacy functionality | Modular replacement |
| --- | --- |
| Driver CRUD endpoints | `createDriversRoutes` preserves driver list, detail, creation, update, and delete flows on `/api/drivers`.【F:server/routes/drivers.ts†L8-L89】 |
| Volunteer management | `createVolunteersRoutes` retains volunteer listing, CRUD, and export behavior via `/api/volunteers`.【F:server/routes/volunteers.ts†L11-L137】 |
| Host and host-contact management | `hostsRoutes` exposes host CRUD plus contact endpoints, covering `/api/hosts`, `/api/host-contacts`, and related helper routes.【F:server/routes/hosts.ts†L31-L247】 |
| Recipient CRUD and status updates | `recipientsRoutes` handles listing, creation, updates, deletes, and status changes on `/api/recipients`.【F:server/routes/recipients.ts†L10-L169】 |

## Messaging, Notifications, and Real-time Features
| Legacy functionality | Modular replacement |
| --- | --- |
| User notifications (list, read, archive, analytics) | `notificationsRouter` now serves notification listing, counts, read/archive mutations, and sub-routers (smart, analytics, tests) beneath `/api/notifications`.【F:server/routes/notifications/index.ts†L28-L218】 |
| Kudos and unread messaging helpers | `messagingRouter` continues the kudos/unread workflows expected by the legacy routes while the modular mount keeps the `/api/messaging` path stable.【F:server/routes/messaging.ts†L7-L174】 |
| Stream Chat token/channel utilities | `streamRoutes` exposes credential and channel helpers when mounted under `/api/stream`, matching the legacy WebSocket helpers.【F:server/routes/stream.ts†L28-L200】 |

## Result
All functional areas covered by the removed `temp_clean_routes.ts`, `temp_routes_clean.ts`, and `server/routes_backup.ts` now live in modular routers that `server/routes/index.ts` mounts into the Express app. After confirming parity, the obsolete files were removed from the repository history and are no longer present in the working tree.
