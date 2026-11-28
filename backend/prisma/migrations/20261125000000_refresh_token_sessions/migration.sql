-- Persistent, revocable refresh-token sessions.
-- Only SHA-256 token hashes are stored; raw refresh tokens are returned once to the client.
CREATE TABLE "RefreshToken" (
  id SERIAL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "familyId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "revokedAt" TIMESTAMPTZ,
  "replacedByTokenHash" TEXT
);

CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken" ("userId", "revokedAt");
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken" ("familyId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken" ("expiresAt");
