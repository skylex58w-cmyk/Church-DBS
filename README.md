# Church-DBS

A Church Management System with a TypeScript/Express API, PostgreSQL database, Prisma ORM, and a Next.js frontend.

## Frontend quick start

Requirements: Node.js 20.9 or newer and a running backend/database.

1. Configure the backend environment and start PostgreSQL/API as described below.
2. Set `AUTH_ALLOWED_ORIGINS=http://localhost:3001` in the root environment file used by Docker Compose.
3. In `frontend/`, copy `.env.example` to `.env.local`.
4. Install and start the frontend:

   ```sh
   npm install
   npm run dev
   ```

5. Open `http://localhost:3001/login`.

The frontend calls the API at `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`). Login and refresh use credentialed requests. Refresh tokens are stored in HttpOnly cookies; access tokens remain in application memory and are not persisted to browser storage.

## Backend quick start

1. Configure PostgreSQL and copy `backend/.env.example` to the backend environment file.
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
5. See `documentation/authentication-sessions.md` for token lifecycle, allowed-origin configuration, and browser security details.

## Current implementation boundary

The frontend currently provides the sign-in flow, refresh-based session restoration, a protected dashboard shell, and logout. Church business modules are intentionally not presented as functional until their API endpoints, branch-isolation rules, permission checks, and integration tests exist.

A successful build or CI run does not by itself mean the full application is production-ready. Existing databases must be backed up and assessed before migrations are applied. Production deployment must use HTTPS, strong unique secrets, and the exact frontend origin allowlist.
