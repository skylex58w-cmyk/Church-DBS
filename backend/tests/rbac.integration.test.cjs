const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const { requirePermission } = require('../dist/rbac/requirePermission');
const usersRouter = require('../dist/users/users.controller').default;

const prisma = new PrismaClient();
const secret = 'integration-test-secret-that-is-at-least-32-characters';
process.env.JWT_SECRET = secret;

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const emailGlobal = `global-${suffix}@example.test`;
const emailBranch = `branch-${suffix}@example.test`;
const permissionName = `test.read.${suffix}`;
const manageRolesPermissionName = 'roles.manage';
let targetUser;
let assignableRole;
let globalGrantRole;
let globalUser;
let branchUser;
let branchA;
let branchB;
let server;
let baseUrl;

function tokenFor(user) {
  return jwt.sign({ email: user.email }, secret, {
    subject: String(user.id),
    algorithm: 'HS256',
    expiresIn: '5m',
  });
}

async function get(path, token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  return fetch(`${baseUrl}${path}`, { headers });
}

before(async () => {
  branchA = await prisma.branch.create({ data: { name: `Test Branch A ${suffix}` } });
  branchB = await prisma.branch.create({ data: { name: `Test Branch B ${suffix}` } });
  const permission = await prisma.permission.create({ data: { name: permissionName } });
  const manageRolesPermission = await prisma.permission.upsert({ where: { name: manageRolesPermissionName }, update: {}, create: { name: manageRolesPermissionName } });
  const globalRole = await prisma.role.create({ data: { name: `Global Test Role ${suffix}` } });
  const branchRole = await prisma.role.create({ data: { name: `Branch Test Role ${suffix}` } });

  globalUser = await prisma.user.create({
    data: { email: emailGlobal, passwordHash: 'not-used-in-this-test' },
  });
  branchUser = await prisma.user.create({
    data: { email: emailBranch, passwordHash: 'not-used-in-this-test' },
  });
  targetUser = await prisma.user.create({ data: { email: `target-${suffix}@example.test`, passwordHash: 'not-used-in-this-test' } });
  assignableRole = await prisma.role.create({ data: { name: `Assignable Role ${suffix}` } });
  globalGrantRole = await prisma.role.create({ data: { name: `Global Grant Role ${suffix}` } });
  await prisma.rolePermission.create({ data: { roleId: globalGrantRole.id, permissionId: manageRolesPermission.id } });

  await prisma.rolePermission.createMany({ data: [
    { roleId: globalRole.id, permissionId: permission.id },
    { roleId: globalRole.id, permissionId: manageRolesPermission.id },
  ] });
  await prisma.userRole.create({
    data: { userId: globalUser.id, roleId: globalRole.id },
  });

  await prisma.rolePermission.createMany({ data: [
    { roleId: branchRole.id, permissionId: permission.id, branchId: branchA.id },
    { roleId: branchRole.id, permissionId: manageRolesPermission.id, branchId: branchA.id },
  ] });
  await prisma.userRole.create({
    data: { userId: branchUser.id, roleId: branchRole.id, branchId: branchA.id },
  });

  const app = express();
  app.use('/users', usersRouter);
  app.get('/branches/:branchId/resource', requirePermission(permissionName), (req, res) => {
    res.json({ success: true, branchId: req.user.branchId });
  });
  app.get('/global/resource', requirePermission(permissionName), (_req, res) => {
    res.json({ success: true });
  });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (globalUser) await prisma.user.delete({ where: { id: globalUser.id } });
  if (branchUser) await prisma.user.delete({ where: { id: branchUser.id } });
  if (targetUser) await prisma.user.delete({ where: { id: targetUser.id } });
  if (assignableRole) await prisma.role.delete({ where: { id: assignableRole.id } });
  if (globalGrantRole) await prisma.role.delete({ where: { id: globalGrantRole.id } });
  await prisma.role.deleteMany({ where: { name: { in: [`Global Test Role ${suffix}`, `Branch Test Role ${suffix}`] } } });
  await prisma.permission.deleteMany({ where: { name: permissionName } });
  // Keep the shared roles.manage permission because the seed catalogue may own it.
  if (branchA) await prisma.branch.delete({ where: { id: branchA.id } });
  if (branchB) await prisma.branch.delete({ where: { id: branchB.id } });
  await prisma.$disconnect();
});

describe('requirePermission PostgreSQL integration', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await get(`/branches/${branchA.id}/resource`);
    assert.equal(response.status, 401);
  });

  it('rejects invalid bearer tokens', async () => {
    const response = await get(`/branches/${branchA.id}/resource`, 'not-a-valid-token');
    assert.equal(response.status, 401);
  });

  it('allows a global role grant in a requested branch', async () => {
    const response = await get(`/branches/${branchB.id}/resource`, tokenFor(globalUser));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, branchId: branchB.id });
  });

  it('allows a branch-scoped grant in its own branch', async () => {
    const response = await get(`/branches/${branchA.id}/resource`, tokenFor(branchUser));
    assert.equal(response.status, 200);
  });

  it('denies a branch-scoped grant in a different branch', async () => {
    const response = await get(`/branches/${branchB.id}/resource`, tokenFor(branchUser));
    assert.equal(response.status, 403);
  });

  it('does not treat branch-scoped access as global access', async () => {
    const response = await get('/global/resource', tokenFor(branchUser));
    assert.equal(response.status, 403);
  });

  it('rejects malformed branch identifiers', async () => {
    const response = await get('/branches/not-a-number/resource', tokenFor(globalUser));
    assert.equal(response.status, 400);
  });

  it('allows a global role manager to assign a global role', async () => {
    const response = await fetch(`${baseUrl}/users/${targetUser.id}/roles`, {
      method: 'POST', headers: { authorization: `Bearer ${tokenFor(globalUser)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ roleId: assignableRole.id }),
    });
    assert.equal(response.status, 201);
    const assignment = await prisma.userRole.findFirst({ where: { userId: targetUser.id, roleId: assignableRole.id, branchId: null } });
    assert.ok(assignment);
  });

  it('allows a branch role manager to assign a role in its own branch', async () => {
    const response = await fetch(`${baseUrl}/users/${targetUser.id}/roles`, {
      method: 'POST', headers: { authorization: `Bearer ${tokenFor(branchUser)}`, 'x-branch-id': String(branchA.id), 'content-type': 'application/json' },
      body: JSON.stringify({ roleId: assignableRole.id, branchId: branchA.id }),
    });
    assert.equal(response.status, 201);
  });

  it('denies a branch role manager from assigning a role with global permission grants', async () => {
    const response = await fetch(`${baseUrl}/users/${targetUser.id}/roles`, {
      method: 'POST', headers: { authorization: `Bearer ${tokenFor(branchUser)}`, 'x-branch-id': String(branchA.id), 'content-type': 'application/json' },
      body: JSON.stringify({ roleId: globalGrantRole.id, branchId: branchA.id }),
    });
    assert.equal(response.status, 403);
  });

  it('denies a branch role manager from assigning a role to another branch', async () => {
    const response = await fetch(`${baseUrl}/users/${targetUser.id}/roles`, {
      method: 'POST', headers: { authorization: `Bearer ${tokenFor(branchUser)}`, 'x-branch-id': String(branchA.id), 'content-type': 'application/json' },
      body: JSON.stringify({ roleId: assignableRole.id, branchId: branchB.id }),
    });
    assert.equal(response.status, 403);
  });

  it('allows revoking an assignment at the same branch scope', async () => {
    const response = await fetch(`${baseUrl}/users/${targetUser.id}/roles/${assignableRole.id}?branchId=${branchA.id}`, {
      method: 'DELETE', headers: { authorization: `Bearer ${tokenFor(branchUser)}`, 'x-branch-id': String(branchA.id) },
    });
    assert.equal(response.status, 200);
    const assignment = await prisma.userRole.findFirst({ where: { userId: targetUser.id, roleId: assignableRole.id, branchId: branchA.id } });
    assert.equal(assignment, null);
  });
});
