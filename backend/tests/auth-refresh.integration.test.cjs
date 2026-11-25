const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const authRouter = require('../dist/auth/auth.controller').default;

const prisma = new PrismaClient();
const secret = 'integration-test-secret-that-is-at-least-32-characters';
process.env.JWT_SECRET = secret;
process.env.REFRESH_TOKEN_TTL_DAYS = '30';
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const email = `auth-refresh-${suffix}@example.test`;
const password = 'test-password-at-least-12-characters';
let user;
let server;
let baseUrl;
let firstRefreshToken;
let secondRefreshToken;

function tokenHash(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

async function post(path, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

before(async () => {
  user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 4) },
  });
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
});

describe('refresh-token session lifecycle', () => {
  it('issues an access token and stores only a hash of the refresh token on login', async () => {
    const response = await post('/auth/login', { email, password });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.tokenType, 'Bearer');
    assert.ok(body.data.token);
    assert.ok(body.data.refreshToken);
    assert.notEqual(body.data.refreshToken.length, 0);
    assert.equal(jwt.verify(body.data.token, secret).sub, String(user.id));
    firstRefreshToken = body.data.refreshToken;

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: tokenHash(firstRefreshToken) } });
    assert.ok(stored);
    assert.notEqual(stored.tokenHash, firstRefreshToken);
    assert.equal(stored.userId, user.id);
    assert.equal(stored.revokedAt, null);
  });

  it('rotates a refresh token and rejects reuse while revoking the token family', async () => {
    const response = await post('/auth/refresh', { refreshToken: firstRefreshToken });
    assert.equal(response.status, 200);
    const body = await response.json();
    secondRefreshToken = body.data.refreshToken;
    assert.ok(secondRefreshToken);
    assert.notEqual(secondRefreshToken, firstRefreshToken);
    assert.equal(jwt.verify(body.data.token, secret).sub, String(user.id));

    const oldRecord = await prisma.refreshToken.findUnique({ where: { tokenHash: tokenHash(firstRefreshToken) } });
    assert.ok(oldRecord.revokedAt);
    assert.equal(oldRecord.replacedByTokenHash, tokenHash(secondRefreshToken));

    const replay = await post('/auth/refresh', { refreshToken: firstRefreshToken });
    assert.equal(replay.status, 401);
    assert.equal((await replay.json()).error.code, 'REFRESH_TOKEN_REUSE');

    const activeRecord = await prisma.refreshToken.findUnique({ where: { tokenHash: tokenHash(secondRefreshToken) } });
    assert.ok(activeRecord.revokedAt, 'replay must revoke the active successor token');
    const afterReuse = await post('/auth/refresh', { refreshToken: secondRefreshToken });
    assert.equal(afterReuse.status, 401);
  });

  it('revokes a session on logout and treats repeated logout as idempotent', async () => {
    const login = await post('/auth/login', { email, password });
    const refreshToken = (await login.json()).data.refreshToken;

    const logout = await post('/auth/logout', { refreshToken });
    assert.equal(logout.status, 200);
    assert.deepEqual((await logout.json()).data, { loggedOut: true });

    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: tokenHash(refreshToken) } });
    assert.ok(record.revokedAt);
    const repeatedLogout = await post('/auth/logout', { refreshToken });
    assert.equal(repeatedLogout.status, 200);

    const refresh = await post('/auth/refresh', { refreshToken });
    assert.equal(refresh.status, 401);
  });

  it('rejects and revokes an expired refresh token', async () => {
    const login = await post('/auth/login', { email, password });
    assert.equal(login.status, 200);
    const refreshToken = (await login.json()).data.refreshToken;
    const hash = tokenHash(refreshToken);
    await prisma.refreshToken.update({
      where: { tokenHash: hash },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await post('/auth/refresh', { refreshToken });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error.code, 'REFRESH_TOKEN_EXPIRED');
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    assert.ok(record.revokedAt);
  });

  it('allows only one concurrent refresh and revokes the family after the competing replay', async () => {
    const login = await post('/auth/login', { email, password });
    assert.equal(login.status, 200);
    const refreshToken = (await login.json()).data.refreshToken;
    const original = await prisma.refreshToken.findUnique({
      where: { tokenHash: tokenHash(refreshToken) },
    });

    const responses = await Promise.all([
      post('/auth/refresh', { refreshToken }),
      post('/auth/refresh', { refreshToken }),
    ]);
    const statuses = responses.map((response) => response.status).sort();
    assert.deepEqual(statuses, [200, 401]);

    const rejected = responses.find((response) => response.status === 401);
    assert.equal((await rejected.json()).error.code, 'REFRESH_TOKEN_REUSE');
    const family = await prisma.refreshToken.findMany({
      where: { familyId: original.familyId },
    });
    assert.ok(family.length >= 2);
    assert.ok(family.every((record) => record.revokedAt), 'concurrent reuse must revoke every token in the family');
  });

  it('rejects malformed refresh-token input', async () => {
    const response = await post('/auth/refresh', { refreshToken: 'short' });
    assert.equal(response.status, 400);
  });
});
