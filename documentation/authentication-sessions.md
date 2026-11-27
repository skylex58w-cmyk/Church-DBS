# Authentication and refresh-token sessions

## Endpoints

All routes are mounted under `/api/v1/auth`.

- `POST /login` accepts `email` and `password`; returns a short-lived JWT access token and sets the refresh token in an HttpOnly cookie.
- `POST /refresh` reads the refresh cookie, consumes the presented token and returns a new access token while rotating the cookie.
- `POST /logout` reads and revokes the refresh cookie, then clears it. Logout is idempotent.
- `POST /register` remains disabled.

## Token handling

Access tokens are signed with `JWT_SECRET`, use HS256, and identify the user through the JWT subject. Their lifetime is configured with `JWT_EXPIRES_IN` (default `1h`).

Refresh tokens are generated from 48 cryptographically random bytes. The API stores only a SHA-256 hash, never the raw token. The raw token is transported only in the `chms_refresh` cookie, configured as HttpOnly, SameSite=Lax, scoped to `/api/v1/auth`, and Secure when `NODE_ENV=production`. Its lifetime is configured with `REFRESH_TOKEN_TTL_DAYS` (default `30`, allowed range 1–365).

Each login starts a token family. A successful refresh atomically revokes the old token, records the replacement hash, and inserts the new token in the same family. A revoked token presented again is treated as reuse; all still-active tokens in that family are revoked. Concurrent attempts to rotate the same token are treated as reuse as well. Expired tokens are rejected and marked revoked.

## Browser request protection

Cookie-authenticated `/refresh` and `/logout` requests require an `Origin` header whose exact origin is listed in `AUTH_ALLOWED_ORIGINS` (comma-separated, no trailing paths). Requests without an allowed Origin are rejected. Configure the frontend's exact origin before deployment, for example `https://church.example.org`. Do not use a wildcard. The browser must send requests with credentials enabled (`credentials: 'include'`).

Use HTTPS in every non-local environment. The cookie is Secure automatically when `NODE_ENV=production`. If the frontend and API are deployed on different sites, SameSite=Lax will not support cross-site cookie delivery; that deployment requires an explicit review of SameSite=None; Secure, credentialed CORS, and CSRF controls before changing this default.

## Access-token limitation

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
