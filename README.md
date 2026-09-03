# Church-DBS

A Church Management System — Part 1 scaffold.

This branch contains the initial scaffold for the Church Management System (backend + frontend skeleton), database schema, basic authentication and RBAC stubs, Docker Compose for local development, and documentation skeleton.

See documentation/ for next steps.

Quick start (development)

1. Copy .env.example to .env and fill values.
2. Start services: docker-compose up -d
3. Enter backend container or run locally:
   - cd backend
   - npm install
   - npx prisma generate
   - npx prisma migrate dev --name init
   - npm run start:dev
4. Open frontend/README.md for frontend run instructions.

Note: This is Part 1 scaffold. Many modules are placeholders and marked in documentation/traceability.md.
