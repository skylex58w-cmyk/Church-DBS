# Branch API and access scope

The branch read API is mounted under `/api/v1/branches` and requires a Bearer access token.

## Permission

The API uses the `branches.view` permission. The RBAC seed adds this permission to the catalogue and grants it to the global Super Administrator role. Other roles must receive an explicit grant at the appropriate scope.

## Endpoints

- `GET /api/v1/branches`
  - Without `X-Branch-Id`, requires a global `branches.view` grant and returns the branch catalogue.
  - With `X-Branch-Id: <id>`, authorizes the requested branch through RBAC and returns only that branch.
- `GET /api/v1/branches/:branchId`
  - Returns one branch after permission and scope checks.
  - A branch-scoped administrator cannot read a different branch by changing the path parameter.

The API returns only branch identifiers, names, codes, and creation timestamps. It does not expose branch-related user or financial records.

## Frontend behaviour

The dashboard first attempts to load the global branch catalogue. If the account is branch-scoped, it retries only for branch IDs already present in the authenticated user's role assignments, passing each ID in `X-Branch-Id`. The selector therefore uses server-authorized branch records rather than a hard-coded list.

Selecting a branch currently establishes the dashboard's active branch context only. Feature modules must still send `X-Branch-Id` on each branch-scoped API request, and every backend endpoint must independently enforce its permission and branch scope. Hiding a branch or control in the frontend is not an authorization boundary.

## Validation

The PostgreSQL RBAC integration suite covers global branch listing, branch-scoped listing, and denial when a branch-scoped user requests a different branch. CI validates the Prisma schema, applies migrations to a clean PostgreSQL database, compiles the backend, and runs the integration suite.
