# RBAC traceability

Requirement: Implement granular module.action permissions with branch, department, or record scope (Master Spec §5, §6, §14)

Files implementing requirement:
- backend/prisma/schema.prisma — Role, Permission, RolePermission, UserRole models
- backend/prisma/seed.ts — seed script for default permissions and Super Administrator role
- backend/src/rbac/requirePermission.ts — middleware enforcing permissions and scopes
- backend/src/routes/admin.permissions.ts — admin endpoints to view/manage roles & permissions
- tests/unit/rbac.guard.test.ts — unit test skeleton for RBAC checks

Database tables:
- User, Role, Permission, RolePermission, UserRole

API endpoints / routes:
- GET /api/v1/admin/permissions — list permissions (protected by users.manage permission)
- GET /api/v1/admin/roles — list roles
- POST /api/v1/admin/roles/:id/permissions — attach permission to role

Tests mapped to baseline:
- TC007 Authorization — tests in tests/unit/rbac.guard.test.ts (marked pending until CI runs)

Status:
- Schema and seed script added on feature/part1-rbac branch
- Middleware and admin routes implemented (needs integration into main app)

Notes:
- Ensure prisma migrate is executed after merging the branch: `npx prisma migrate dev --name add-rbac`
- Run seed with: `NODE_ENV=development ts-node backend/prisma/seed.ts`
