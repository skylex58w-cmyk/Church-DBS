# Draft PR: feat(rbac): seed & admin routes wiring

This document describes the intended draft Pull Request for the RBAC baseline work pushed to feature/part1-rbac.

Summary of changes in this PR:
- Add users.manage and roles.manage permissions to the RBAC seed
- Ensure Super Administrator role is populated with all permissions
- Add registerAdminRoutes helper to wire admin routes into the main Express application
- Provide guidance and traceability documentation

Files changed/added:
- backend/prisma/seed.ts (updated to include users.manage and roles.manage + robust upserts)
- backend/src/routes/registerAdminRoutes.ts (helper to mount admin routes under /api/v1/admin)
- documentation/traceability/rbac.md (already present)

How to test locally:
1. Checkout branch feature/part1-rbac
2. Run prisma migrate / db push and prisma generate
3. Run the seed script:
   NODE_ENV=development npx ts-node backend/prisma/seed.ts
4. Start the backend and ensure the Super Administrator (seeded) can call GET /api/v1/admin/permissions with a valid JWT

Notes:
- The project may already have an app/server entrypoint; registerAdminRoutes.ts is intentionally non-invasive and should be imported and invoked from the existing app bootstrap (e.g., in backend/src/server.ts or backend/src/app.ts).
- If you want, I can add the import and invocation in the project's main server file — confirm and I will attempt to modify it.
