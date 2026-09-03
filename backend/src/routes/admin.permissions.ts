import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = express.Router();
const prisma = new PrismaClient();

// List permissions (admin-level)
router.get('/permissions', requirePermission('users.manage') as any, async (req, res) => {
  const perms = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
  res.json({ success: true, data: perms });
});

// List roles
router.get('/roles', requirePermission('users.manage') as any, async (req, res) => {
  const roles = await prisma.role.findMany({ include: { rolePermission: { include: { permission: true } } } });
  res.json({ success: true, data: roles });
});

// Assign permission to role
router.post('/roles/:roleId/permissions', requirePermission('users.manage') as any, async (req, res) => {
  const { roleId } = req.params;
  const { permissionId, branchId } = req.body;
  try {
    const rp = await prisma.rolePermission.create({ data: { roleId: Number(roleId), permissionId: Number(permissionId), branchId: branchId ? Number(branchId) : null } });
    res.json({ success: true, data: rp });
  } catch (err) {
    res.status(400).json({ success: false, error: { code: 'INVALID_REQUEST', message: 'Could not attach permission' } });
  }
});

export default router;
