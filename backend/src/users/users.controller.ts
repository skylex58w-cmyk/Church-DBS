import { Router, Request } from 'express';
import { body, validationResult } from 'express-validator';
import UsersService from './users.service';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const svc = new UsersService();

interface AdminRequest extends Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function assignmentScope(req: AdminRequest, requestedBranchId: unknown): number | null | undefined {
  const actorBranchId = req.user?.branchId;
  const branchId = requestedBranchId === undefined || requestedBranchId === null || requestedBranchId === ''
    ? null
    : positiveId(requestedBranchId);
  if (requestedBranchId !== undefined && requestedBranchId !== null && requestedBranchId !== '' && branchId === null) {
    return undefined;
  }
  // Branch-scoped administrators may assign or revoke roles only in their active branch.
  // They cannot create or remove global assignments.
  if (actorBranchId !== null && actorBranchId !== branchId) return undefined;
  return branchId;
}

router.get('/', requirePermission('users.manage') as any, async (req: AdminRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator context is missing' } });
    }\n    const users = await svc.findAll(req.user.branchId);
    return res.json({ success: true, data: users });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to retrieve users' },
    });
  }
});

router.post(
  '/',
  requirePermission('users.manage') as any,
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 12 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.array() },
      });
    }

    try {
      const user = await svc.create(req.body.email, req.body.password);
      return res.status(201).json({
        success: true,
        data: { id: user.id, email: user.email },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      if (message.toLowerCase().includes('unique constraint')) {
        return res.status(409).json({
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
        });
      }
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Unable to create user' },
      });
    }
  },
);

router.post(
  '/:userId/roles',
  requirePermission('roles.manage') as any,
  body('roleId').custom((value) => positiveId(value) !== null),
  body('branchId').optional({ nullable: true }).custom((value) => value === '' || positiveId(value) !== null),
  async (req: AdminRequest, res) => {
    const errors = validationResult(req);
    const userId = positiveId(req.params.userId);
    const roleId = positiveId(req.body.roleId);
    if (!errors.isEmpty() || userId === null || roleId === null) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'User ID and role ID must be positive integers; branch ID must be a positive integer when supplied' },
      });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator context is missing' } });
    }
    const branchId = assignmentScope(req, req.body.branchId);
    if (branchId === undefined) {
      return res.status(403).json({ success: false, error: { code: 'BRANCH_SCOPE_FORBIDDEN', message: 'You may only manage role assignments in your active branch' } });
    }

    try {
      if (!await svc.roleGrantsWithinActorPermissions(roleId, branchId, req.user.permissions)) {
        return res.status(403).json({ success: false, error: { code: 'ROLE_SCOPE_FORBIDDEN', message: 'You cannot assign a role containing permissions outside your own access' } });
      }
      if (!await svc.roleAssignmentTargetsExist(userId, roleId, branchId)) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User, role, or branch was not found' } });
      }
      const assignment = await svc.assignRole(userId, roleId, branchId);
      return res.status(201).json({ success: true, data: assignment });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_ASSIGNED', message: 'This role is already assigned at the requested scope' } });
      }
      console.error('User role assignment failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to assign role' } });
    }
  },
);

router.delete(
  '/:userId/roles/:roleId',
  requirePermission('roles.manage') as any,
  async (req: AdminRequest, res) => {
    const userId = positiveId(req.params.userId);
    const roleId = positiveId(req.params.roleId);
    if (userId === null || roleId === null) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'User ID and role ID must be positive integers' } });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator context is missing' } });
    }
    const branchId = assignmentScope(req, req.query.branchId);
    if (branchId === undefined) {
      return res.status(403).json({ success: false, error: { code: 'BRANCH_SCOPE_FORBIDDEN', message: 'You may only manage role assignments in your active branch' } });
    }

    try {
      const result = await svc.revokeRole(userId, roleId, branchId);
      if (result.count === 0) {
        return res.status(404).json({ success: false, error: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Role assignment was not found at the requested scope' } });
      }
      return res.json({ success: true, data: { revoked: result.count } });
    } catch (error) {
      console.error('User role revocation failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to revoke role' } });
    }
  },
);

export default router;
