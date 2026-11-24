-- Church DBS baseline and branch-scope integrity migration.
-- Safe for a fresh database and the legacy RBAC tables created by
-- database/migrations/0001_rbac.sql. Existing records are preserved.
-- If legacy branchId values refer to branches that do not exist, this
-- migration intentionally fails rather than silently reassigning access.

CREATE TABLE IF NOT EXISTS "Branch" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "User" (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "fullName" TEXT,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Upgrade the legacy SQL schema's User.password column without losing hashes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User' AND column_name = 'password'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User' AND column_name = 'passwordHash'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "password" TO "passwordHash";
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'User' AND column_name = 'password'
  ) THEN
    EXECUTE 'UPDATE "User" SET "passwordHash" = "password" WHERE "passwordHash" IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE "passwordHash" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make User.passwordHash required: one or more users have no password hash';
  END IF;
END $$;
ALTER TABLE "User" ALTER COLUMN "passwordHash" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "createdAt" SET DEFAULT now();

CREATE TABLE IF NOT EXISTS "Role" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Permission" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "RolePermission" (
  id SERIAL PRIMARY KEY,
  "roleId" INTEGER NOT NULL REFERENCES "Role"(id) ON DELETE CASCADE,
  "permissionId" INTEGER NOT NULL REFERENCES "Permission"(id) ON DELETE CASCADE,
  "branchId" INTEGER
);

CREATE TABLE IF NOT EXISTS "UserRole" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "roleId" INTEGER NOT NULL REFERENCES "Role"(id) ON DELETE CASCADE,
  "branchId" INTEGER
);

ALTER TABLE "RolePermission" ADD COLUMN IF NOT EXISTS "branchId" INTEGER;
ALTER TABLE "UserRole" ADD COLUMN IF NOT EXISTS "branchId" INTEGER;

-- Add branch foreign keys only once. Existing invalid branch references cause
-- the migration to stop, so access assignments are never silently rewritten.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RolePermission_branchId_fkey') THEN
    ALTER TABLE "RolePermission"
      ADD CONSTRAINT "RolePermission_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserRole_branchId_fkey') THEN
    ALTER TABLE "UserRole"
      ADD CONSTRAINT "UserRole_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "Branch"(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- PostgreSQL treats NULL values as distinct in ordinary UNIQUE constraints.
-- These partial indexes correctly prevent duplicate global grants/assignments
-- as well as duplicate branch-scoped grants/assignments.
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_global_unique"
  ON "RolePermission" ("roleId", "permissionId") WHERE "branchId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_branch_unique"
  ON "RolePermission" ("roleId", "permissionId", "branchId") WHERE "branchId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_global_unique"
  ON "UserRole" ("userId", "roleId") WHERE "branchId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_branch_unique"
  ON "UserRole" ("userId", "roleId", "branchId") WHERE "branchId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "RolePermission_branchId_idx" ON "RolePermission" ("branchId");
CREATE INDEX IF NOT EXISTS "UserRole_branchId_idx" ON "UserRole" ("branchId");
