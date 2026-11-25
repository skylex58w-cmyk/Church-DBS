# Authentication and refresh-token sessions

## Endpoints

All routes are mounted under `/api/v1/auth`.

- `POST /login` accepts `email` and `password`; returns a short-lived JWT access token and an opaque refresh token.
- `POST /refresh` accepts `refreshToken`; consumes the presented token and returns a new access token and a replacement refresh token.
- `POST /logout` accepts `refreshToken`; revokes that token. Logout is idempotent.
- `POST /register` remains disabled.

## Token handling

Access tokens are signed with `JWT_SECRET`, use HS256, and identify the user through the JWT subject. Their lifetime is configured with `JWT_EXPIRES_IN` (default `1h`).

Refresh tokens are generated from 48 cryptographically random bytes. The API stores only a SHA-256 hash, never the raw token. Each login starts a token family. A successful refresh atomically revokes the old token, records the replacement hash, and inserts the new token in the same family. Refresh-token lifetime is configured with `REFRESH_TOKEN_TTL_DAYS` (default `30`, allowed range 1–365).

A revoked token presented again is treated as reuse. The API revokes all still-active tokens in that family and requires the user to sign in again. Concurrent attempts to rotate the same token are treated as reuse as well. Expired tokens are rejected and marked revoked.

## Client security requirements

The current API returns refresh tokens in the JSON response body to support the existing API client integration. A browser client must not place refresh tokens in local storage or expose them to JavaScript-accessible persistent storage. Before production browser deployment, move refresh-token transport to a Secure, HttpOnly, SameSite cookie, add CSRF protection appropriate to the chosen cookie policy, and keep access tokens short-lived and in memory. Use HTTPS in every non-local environment.

The access JWT is stateless: logging out revokes the refresh token but does not invalidate an already-issued access token before its expiry. Keep access-token expiry short; immediate access-token revocation would require an additional server-side denylist or session-version check.

## Database migration

Deploy the migration with:

```sh
npm run prisma:migrate:deploy
npm run prisma:generate
npm run build
npm run test:integration
```

Back up an existing database before applying migrations. The refresh-token table is created empty; existing users can continue to sign in and receive a new refresh-token session at their next login.
