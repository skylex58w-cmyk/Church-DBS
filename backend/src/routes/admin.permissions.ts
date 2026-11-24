import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = express.Router();
const prisma = new PrismaClient();

interface AdminRequest extends express.Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

router.get('/permissions', requirePermission('roles.manage') as any, async (_req, res) => {
  try {
    const permissions = await prisma.permission.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, data: permissions });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to retrieve permissions' },
    });
  }
});

router.get('/roles', requirePermission('roles.manage') as any, async (_req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: { rolePermission: { include: { permission: true, branch: true } } },
      orderBy: { name: 'asc' },
    });
    return res.json({ success: true, data: roles });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to retrieve roles' },
    });
  }
});

router.post(
  '/roles/:roleId/permissions',
  requirePermission('roles.manage') as any,
  async (req: AdminRequest, res) => {
    const roleId = Number(req.params.roleId);
    const permissionId = Number(req.body.permissionId);
    const branchId = req.body.branchId === undefined || req.body.branchId === null || req.body.branchId === ''
      ? null
      : Number(req.body.branchId);

    if (!Number.isSafeInteger(roleId) || roleId <= 0 ||
        !Number.isSafeInteger(permissionId) || permissionId <= 0 ||
        (branchId !== null && (!Number.isSafeInteger(branchId) || branchId <= 0))) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Role, permission, and optional branch IDs must be positive integers' },
      });
    }

    const actorBranchId = req.user?.branchId ?? null;
    // A branch-scoped administrator may only grant permissions within that same branch.
    // Only a global administrator can create global grants or grants for another branch.
    if (actorBranchId !== null && branchId !== actorBranchId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot manage permissions outside your assigned branch' },
      });
    }

    try {
      const [role, permission, branch] = await Promise.all([
        prisma.role.findUnique({ where: { id: roleId }, select: { id: true } }),
        prisma.permission.findUnique({ where: { id: permissionId }, select: { id: true } }),
        branchId === null
          ? Promise.resolve(true)
          : prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } }),
      ]);

      if (!role || !permission || !branch) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Role, permission, or branch was not found' },
        });
      }

      const existing = await prisma.rolePermission.findFirst({
        where: { roleId, permissionId, branchId },
        select: { id: true },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'ALREADY_ASSIGNED', message: 'Permission is already assigned at this scope' },
        });
      }

      const grant = await prisma.rolePermission.create({
        data: { roleId, permissionId, branchId },
      });
      return res.status(201).json({ success: true, data: grant });
    } catch (error) {
      console.error('Role permission assignment failed', error);
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Unable to assign permission' },
      });
    }
  },
);

export default router;
