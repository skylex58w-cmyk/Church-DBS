import { Router, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const prisma = new PrismaClient();
const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const;

interface AttendanceRequest extends Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function activeBranch(req: AttendanceRequest, res: any): number | null {
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

const sessionSelect = {
  id: true, branchId: true, title: true, serviceDate: true, serviceType: true,
  createdAt: true, updatedAt: true,
};

router.get('/', requirePermission('attendance.view') as any, async (req: AttendanceRequest, res) => {
  const branchId = activeBranch(req, res);
  if (branchId === null) return;
  try {
    const sessions = await prisma.attendanceSession.findMany({
      where: { branchId },
      select: { ...sessionSelect, _count: { select: { records: true } } },
      orderBy: [{ serviceDate: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return res.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Attendance session list failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve attendance sessions' } });
  }
});

router.post(
  '/',
  requirePermission('attendance.create') as any,
  body('title').isString().trim().isLength({ min: 1, max: 150 }),
  body('serviceDate').isISO8601({ strict: true }),
  body('serviceType').optional({ nullable: true }).isString().trim().isLength({ max: 80 }),
  async (req: AttendanceRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
    const branchId = activeBranch(req, res);
    if (branchId === null) return;
    try {
      const session = await prisma.attendanceSession.create({
        data: {
          branchId,
          title: req.body.title,
          serviceDate: new Date(req.body.serviceDate),
          ...(req.body.serviceType !== undefined ? { serviceType: req.body.serviceType } : {}),
        },
        select: sessionSelect,
      });
      return res.status(201).json({ success: true, data: session });
    } catch (error) {
      console.error('Attendance session creation failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to create attendance session' } });
    }
  },
);

router.get('/:sessionId', requirePermission('attendance.view') as any, async (req: AttendanceRequest, res) => {
  const branchId = activeBranch(req, res);
  const sessionId = positiveId(req.params.sessionId);
  if (branchId === null) return;
  if (sessionId === null) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Session ID must be a positive integer' } });
  try {
    const session = await prisma.attendanceSession.findFirst({
      where: { id: sessionId, branchId },
      select: {
        ...sessionSelect,
        records: {
          select: {
            id: true, memberId: true, status: true, markedAt: true,
            member: { select: { firstName: true, lastName: true, middleName: true } },
          },
          orderBy: [{ member: { lastName: 'asc' } }, { member: { firstName: 'asc' } }],
        },
      },
    });
    if (!session) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attendance session was not found in this branch' } });
    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('Attendance session retrieval failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve attendance session' } });
  }
});

router.put(
  '/:sessionId/records',
  requirePermission('attendance.update') as any,
  body('records').isArray({ min: 1, max: 500 }),
  body('records.*.memberId').isInt({ min: 1 }),
  body('records.*.status').isIn(STATUSES),
  async (req: AttendanceRequest, res) => {
    const errors = validationResult(req);
    const branchId = activeBranch(req, res);
    const sessionId = positiveId(req.params.sessionId);
    if (branchId === null) return;
    if (sessionId === null || !errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide a valid session ID and 1–500 valid attendance records' } });
    }
    const records = req.body.records as Array<{ memberId: number; status: typeof STATUSES[number] }>;
    const memberIds = records.map((record) => Number(record.memberId));
    if (new Set(memberIds).size !== memberIds.length) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'A member may appear only once per attendance submission' } });
    }
    try {
      const session = await prisma.attendanceSession.findFirst({ where: { id: sessionId, branchId }, select: { id: true } });
      if (!session) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Attendance session was not found in this branch' } });
      const members = await prisma.member.findMany({ where: { id: { in: memberIds }, branchId }, select: { id: true } });
      if (members.length !== memberIds.length) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_MEMBERS', message: 'Every member must belong to the active branch' } });
      }
      const saved = await prisma.$transaction(records.map((record) => prisma.attendanceRecord.upsert({
        where: { sessionId_memberId: { sessionId, memberId: Number(record.memberId) } },
        create: { sessionId, memberId: Number(record.memberId), status: record.status },
        update: { status: record.status, markedAt: new Date() },
        select: { id: true, memberId: true, status: true, markedAt: true },
      })));
      return res.json({ success: true, data: saved });
    } catch (error) {
      console.error('Attendance marking failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to save attendance records' } });
    }
  },
);

export default router;
