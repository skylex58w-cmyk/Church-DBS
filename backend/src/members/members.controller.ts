import { Router, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const prisma = new PrismaClient();

interface MemberRequest extends Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function activeBranch(req: MemberRequest, res: any): number | null {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authenticated user context is missing' } });
    return null;
  }
  if (req.user.branchId === null) {
    res.status(400).json({ success: false, error: { code: 'BRANCH_CONTEXT_REQUIRED', message: 'Select a branch using X-Branch-Id' } });
    return null;
  }
  return req.user.branchId;
}

const memberSelect = {
  id: true, branchId: true, firstName: true, lastName: true, middleName: true,
  gender: true, dateOfBirth: true, phone: true, email: true, address: true,
  maritalStatus: true, membershipStatus: true, joinedAt: true, createdAt: true, updatedAt: true,
};

router.get('/', requirePermission('members.view') as any, async (req: MemberRequest, res) => {
  const branchId = activeBranch(req, res);
  if (branchId === null) return;
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const members = await prisma.member.findMany({
      where: {
        branchId,
        ...(search ? { OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ] } : {}),
      },
      select: memberSelect,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      take: 200,
    });
    return res.json({ success: true, data: members });
  } catch (error) {
    console.error('Member list failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve members' } });
  }
});

router.post(
  '/',
  requirePermission('members.create') as any,
  body('firstName').isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').isString().trim().isLength({ min: 1, max: 100 }),
  body('middleName').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('gender').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('dateOfBirth').optional({ nullable: true }).isISO8601({ strict: true }),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('maritalStatus').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('membershipStatus').optional().isIn(['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DECEASED']),
  body('joinedAt').optional({ nullable: true }).isISO8601({ strict: true }),
  async (req: MemberRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
    const branchId = activeBranch(req, res);
    if (branchId === null) return;
    try {
      const data = { ...req.body };
      if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);
      if (data.joinedAt) data.joinedAt = new Date(data.joinedAt);
      const member = await prisma.member.create({
        data: { ...data, branchId },
        select: memberSelect,
      });
      return res.status(201).json({ success: true, data: member });
    } catch (error) {
      console.error('Member creation failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to create member' } });
    }
  },
);

router.get('/:memberId', requirePermission('members.view') as any, async (req: MemberRequest, res) => {
  const branchId = activeBranch(req, res);
  const memberId = positiveId(req.params.memberId);
  if (branchId === null) return;
  if (memberId === null) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Member ID must be a positive integer' } });
  try {
    const member = await prisma.member.findFirst({ where: { id: memberId, branchId }, select: memberSelect });
    if (!member) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Member was not found in this branch' } });
    return res.json({ success: true, data: member });
  } catch (error) {
    console.error('Member retrieval failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve member' } });
  }
});

router.patch(
  '/:memberId',
  requirePermission('members.update') as any,
  body('firstName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('lastName').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('middleName').optional({ nullable: true }).isString().trim().isLength({ max: 100 }),
  body('gender').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('dateOfBirth').optional({ nullable: true }).isISO8601({ strict: true }),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 40 }),
  body('email').optional({ nullable: true }).isEmail().normalizeEmail(),
  body('address').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('maritalStatus').optional({ nullable: true }).isString().trim().isLength({ max: 30 }),
  body('membershipStatus').optional().isIn(['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'DECEASED']),
  body('joinedAt').optional({ nullable: true }).isISO8601({ strict: true }),
  async (req: MemberRequest, res) => {
    const errors = validationResult(req);
    const memberId = positiveId(req.params.memberId);
    if (!errors.isEmpty() || memberId === null || !Object.keys(req.body).length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide a valid member ID and at least one valid field' } });
    }
    const branchId = activeBranch(req, res);
    if (branchId === null) return;
    const allowed = ['firstName', 'lastName', 'middleName', 'gender', 'dateOfBirth', 'phone', 'email', 'address', 'maritalStatus', 'membershipStatus', 'joinedAt'];
    const data: Record<string, unknown> = {};
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(req.body, key)) data[key] = req.body[key];
    if (data.dateOfBirth) data.dateOfBirth = new Date(String(data.dateOfBirth));
    if (data.joinedAt) data.joinedAt = new Date(String(data.joinedAt));
    try {
      const existing = await prisma.member.findFirst({ where: { id: memberId, branchId }, select: { id: true } });
      if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Member was not found in this branch' } });
      const member = await prisma.member.update({ where: { id: memberId }, data, select: memberSelect });
      return res.json({ success: true, data: member });
    } catch (error) {
      console.error('Member update failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to update member' } });
    }
  },
);

export default router;
