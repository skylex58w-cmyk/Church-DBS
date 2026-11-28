# Member records and branch isolation

## Data ownership
A member is a church person record, not a system login account. Every member belongs to exactly one branch through the required `branchId` foreign key. Branch deletion is restricted while member records exist.

The initial member record contains names, optional contact and demographic details, membership status, join date, and timestamps. Dates of birth and join dates are stored as SQL dates. Membership status is limited by the API to `ACTIVE`, `INACTIVE`, `TRANSFERRED`, or `DECEASED`.

## API
All endpoints are mounted under `/api/v1/members` and require a bearer access token plus an active branch context via `X-Branch-Id`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/` | `members.view` | List up to 200 members in the active branch; optional `search` |
| GET | `/:memberId` | `members.view` | Read one member in the active branch |
| POST | `/` | `members.create` | Create a member in the active branch |
| PATCH | `/:memberId` | `members.update` | Update an existing member in the active branch |

The server assigns the branch from the authenticated request context. A submitted `branchId` in a create payload is ignored. Read and update queries include both member ID and active branch ID; a record in another branch is reported as not found. This avoids exposing whether an out-of-scope member ID exists.

## Permission setup
The permissions `members.view`, `members.create`, and `members.update` are part of the seeded permission catalogue. They must be granted to the relevant role at the appropriate global or branch scope. A branch administrator cannot gain access to another branch by changing the client-supplied header because RBAC validates that scope against the user's assignments and grants.

## Migration
Apply the migration with `npm run prisma:migrate:deploy` from `backend`. The migration creates the `Member` table and branch foreign key. Back up an existing production database before applying migrations.

## Current scope
This stage does not yet implement member deletion, attendance, households/families, pastoral notes, member transfers, or frontend member screens. Those should be added as separate tested workflows. Sensitive pastoral records should not be stored in the general member profile.
