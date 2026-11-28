# Church DBS frontend

Next.js App Router frontend for the Church DBS API.

## Requirements

- Node.js 20.9 or newer
- A running Church DBS backend and PostgreSQL database

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the browser-accessible API base URL (default: `http://localhost:3000/api/v1`).
3. From this directory run:

   ```sh
   npm install
   npm run dev
   ```

4. Open `http://localhost:3001`.

The backend must include `http://localhost:3001` in `AUTH_ALLOWED_ORIGINS`. For Docker Compose, set that value in the root environment file so the API can accept credentialed browser requests.

## Authentication flow

- Login sends credentials to `POST /auth/login` with `credentials: include`.
- The API returns a short-lived bearer access token and sets the refresh token as an HttpOnly cookie.
- The access token is held only in React application memory; it is not written to localStorage or sessionStorage.
- On page load, the app calls `POST /auth/refresh` to restore the session from the cookie.
- Logout calls `POST /auth/logout`, then clears the in-memory access token.
- Protected dashboard content is withheld until session restoration completes.

The dashboard intentionally contains no fabricated member counts, finance figures, or sample records. Business modules will be connected only after their backend endpoints and branch-scoped permissions are implemented.
