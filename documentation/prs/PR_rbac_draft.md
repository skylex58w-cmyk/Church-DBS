# Draft PR: feat(rbac): baseline RBAC models, middleware, seeds

This draft PR implements the RBAC baseline required to enforce granular permissions across the application. It includes database schema additions, a seed script, authorization middleware, admin routes, and initial traceability documentation.

Summary of changes

- Database schema (Prisma): add Role, Permission, RolePermission, UserRole models.
- Seed script: backend/prisma/seed.ts — creates default permissions (members.*, finance.*, reports.export, pastoral.view) and two admin-level permissions users.manage and roles.manage. Seeds a Super Administrator role and assigns all permissions to it. Seeds a development admin user.
- Middleware: backend/src/rbac/requirePermission.ts — Express middleware that verifies JWT, loads user roles/permissions, computes permission set and attaches user context (including scoped permissions).
- Admin routes: backend/src/routes/admin.permissions.ts and helper backend/src/routes/registerAdminRoutes.ts — endpoints to list permissions and roles, and assign permissions to roles. These are mounted at /api/v1/admin.
- Dev convenience: backend/.env.example updated with RBAC_DEV_ADMIN_* env variables. documentation/traceability/rbac.md maps requirements to implementation files.
- Tests: tests/unit/rbac.guard.test.ts (skeleton pending CI execution)

How to test locally

1. Checkout branch:
   git fetch origin
   git checkout feature/part1-rbac

2. Install dependencies:
   cd backend
   npm install

3. Configure environment (copy backend/.env.example → backend/.env) and set DATABASE_URL + JWT_SECRET

4. Run Prisma migration & generate client:
   npx prisma migrate dev --name add-rbac
   npx prisma generate

5. Seed the database:
   NODE_ENV=development npx ts-node backend/prisma/seed.ts

6. Start the backend server:
   npm run start:dev

7. Login as seeded dev admin and list permissions:
   POST /api/v1/auth/login with RBAC_DEV_ADMIN_EMAIL and RBAC_DEV_ADMIN_PASSWORD
   GET /api/v1/admin/permissions (Authorization: Bearer <token>)

Security note

- The seeded admin credentials are for development only. Change/remove them before any production deployment.

Traceability and checklist

See documentation/traceability/rbac.md for mapping between the Master Specification requirements and the implementation artifacts in this PR.

Follow-up work (recommended)

- Add/enable integration tests for the admin endpoints (run in CI against a test DB)
- Integrate requirePermission into key endpoints (members, events, finance) to enforce module.action checks end-to-end
- Implement resource/branch-scoped authorization helpers used by endpoints that manipulate branch-scoped records
- Expand audit logging for role & permission modifications

---

PASTE THE FOLLOWING WHEN OPENING THE PR DESCRIPTION:

Title: feat(rbac): baseline RBAC models, middleware, seeds

Description: Implements RBAC baseline: database schema, seed, middleware, admin endpoints, traceability. See documentation/traceability/rbac.md for requirement mapping and tests.

Checklist:
- [x] Prisma schema changes added
- [x] Seed script with admin user
- [x] requirePermission middleware implemented
- [x] Admin routes and register helper added
- [ ] Integration tests (pending)
- [ ] Audit log hooks (follow-up)

