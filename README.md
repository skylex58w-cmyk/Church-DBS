# Church-DBS

A Church Management System — backend foundation and frontend scaffold.

The backend currently uses Express + TypeScript, Prisma ORM, and PostgreSQL. Prisma migrations are the single source of truth for database schema changes.

## Backend quick start (development)

1. Copy the required environment examples and configure a PostgreSQL database.
2. Start PostgreSQL with `docker compose up -d db`, or use an existing PostgreSQL instance.
3. From `backend/`, install dependencies and generate/apply the database schema:

   ```sh
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   npm run start:dev
   ```

4. See `documentation/database-migrations.md` before connecting an existing database or applying migrations to data that matters.

The frontend remains a scaffold. Authentication hardening, complete branch-scoped authorization, business modules, and automated integration tests are still outstanding. A successful backend build does not mean the full application is production-ready.
