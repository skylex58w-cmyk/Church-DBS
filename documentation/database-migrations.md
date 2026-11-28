# Database schema and migrations

## Source of truth

The canonical schema is `backend/prisma/schema.prisma`. All future schema changes must be made there and committed with a new directory under `backend/prisma/migrations/`. Do not apply the old hand-written SQL migration under `database/migrations`; it has been superseded by Prisma Migrate.

## What the current migration does

`20261124000000_rbac_branch_integrity`:

- Creates the Branch, User, Role, Permission, RolePermission, and UserRole tables when they do not exist.
- Renames the legacy `User.password` column to `passwordHash` when needed, preserving stored password hashes.
- Adds real foreign keys from RolePermission.branchId and UserRole.branchId to Branch.id.
- Adds indexes and partial unique indexes so duplicate global grants/assignments and duplicate branch-scoped grants/assignments are rejected.
- Uses cascading deletes for role/user/permission/branch assignments.

The migration intentionally fails if existing data violates the new constraints (for example, orphaned branch IDs or duplicate grants). Review and correct such records explicitly; do not bypass the failure or delete records blindly.

## Fresh database

Back up nothing if the database is genuinely new and contains no data. Run from `backend/`:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

## Existing database

1. Stop application writes and take a verified PostgreSQL backup.
2. Confirm which schema is present. In particular, inspect the User password column and all non-null RolePermission.branchId / UserRole.branchId values.
3. Ensure every non-null branchId points to a real Branch.id. The previous hand-written SQL migration did not create Branch, so legacy non-null branch scopes may need deliberate mapping to real branches before applying this migration.
4. Check for duplicate role-permission and user-role assignments. The new partial unique indexes will reject duplicates.
5. Apply with `npx prisma migrate deploy` from `backend/`. The migration preserves the existing password hash values when renaming `password`.
6. Verify the resulting schema and application login before resuming writes.

Do not mark the migration as already applied with `prisma migrate resolve` unless the database has been independently verified to match the complete migration result. Do not use `prisma db push` as a substitute for the committed migration history.

## Rollback

This migration is intentionally forward-only because dropping the new constraints or reversing the password column rename without a controlled rollback could compromise data integrity. Restore the verified pre-migration backup if a rollback is required.

## Verification

The CI workflow generates the Prisma Client and runs the TypeScript build. It does not connect to a live PostgreSQL instance, execute the migration, or prove branch isolation. Those require a disposable PostgreSQL integration-test job, which is a subsequent verification step.
