# Attendance management

## Data ownership
An attendance session belongs to exactly one branch. Each record links one member to one session and is unique per session/member pair. The database prevents deleting a member while attendance records refer to that member. Deleting a session cascades to its attendance records.

Attendance statuses accepted by the API are `PRESENT`, `ABSENT`, `LATE`, and `EXCUSED`. Attendance is recorded against existing members in the active branch only. Attendance records do not duplicate member demographic data.

## API
All routes require a bearer access token and an active branch context supplied through `X-Branch-Id`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/` | `attendance.view` | List up to 200 sessions in the active branch |
| POST | `/` | `attendance.create` | Create a session for the active branch |
| GET | `/:sessionId` | `attendance.view` | Read a session and its recorded attendance |
| PUT | `/:sessionId/records` | `attendance.update` | Create or update attendance for 1–500 members |

The API assigns the branch from authenticated request context; it does not accept a branch ID from the request body. Session lookups are branch-scoped. Attendance submission verifies both that the session and every member belong to the active branch before saving records. A member may appear only once in a submission.

## Permissions
The seed catalogue includes `attendance.view`, `attendance.create`, and `attendance.update`. Grant these at the intended global or branch scope through the existing RBAC administration workflow.

## Migration
Apply the migration from `backend` using `npm run prisma:migrate:deploy`. Back up a production database before applying migrations.

## Current scope
This stage provides attendance sessions and per-member status recording. It does not yet include attendance editing UI, bulk import, check-in devices, notifications, recurring service templates, or attendance analytics.
