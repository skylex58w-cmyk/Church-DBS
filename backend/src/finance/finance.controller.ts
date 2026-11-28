import { Router, Request } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const prisma = new PrismaClient();
const TYPES = ['INCOME', 'EXPENSE'] as const;
const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;

interface FinanceRequest extends Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function activeBranch(req: FinanceRequest, res: any): number | null {
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

const transactionSelect = {
  id: true, branchId: true, type: true, category: true, amount: true, currency: true,
  description: true, reference: true, transactionDate: true, status: true,
  recordedById: true, approvedById: true, approvedAt: true, rejectionReason: true,
  createdAt: true, updatedAt: true,
  recordedBy: { select: { id: true, fullName: true, email: true } },
  approvedBy: { select: { id: true, fullName: true, email: true } },
};

router.get('/', requirePermission('finance.record') as any, async (req: FinanceRequest, res) => {
  const branchId = activeBranch(req, res);
  if (branchId === null) return;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  if (status && !(STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid transaction status' } });
  }
  if (type && !(TYPES as readonly string[]).includes(type)) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid transaction type' } });
  }
  try {
    const transactions = await prisma.financeTransaction.findMany({
      where: { branchId, ...(status ? { status } : {}), ...(type ? { type } : {}) },
      select: transactionSelect,
      orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Finance transaction list failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve financial transactions' } });
  }
});

router.post(
  '/',
  requirePermission('finance.record') as any,
  body('type').isIn(TYPES),
  body('category').isString().trim().isLength({ min: 1, max: 100 }),
  body('amount').custom((value) => /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(value)) && Number(value) > 0),
  body('currency').optional().isIn(['NGN']),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('reference').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('transactionDate').isISO8601({ strict: true }),
  async (req: FinanceRequest, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
    const branchId = activeBranch(req, res);
    if (branchId === null) return;
    try {
      const transaction = await prisma.financeTransaction.create({
        data: {
          branchId,
          type: req.body.type,
          category: req.body.category,
          amount: String(req.body.amount),
          currency: req.body.currency || 'NGN',
          description: req.body.description || null,
          reference: req.body.reference || null,
          transactionDate: new Date(req.body.transactionDate),
          recordedById: req.user!.id,
        },
        select: transactionSelect,
      });
      return res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      console.error('Finance transaction creation failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to record financial transaction' } });
    }
  },
);

router.get('/:transactionId', requirePermission('finance.record') as any, async (req: FinanceRequest, res) => {
  const branchId = activeBranch(req, res);
  const transactionId = positiveId(req.params.transactionId);
  if (branchId === null) return;
  if (transactionId === null) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Transaction ID must be a positive integer' } });
  try {
    const transaction = await prisma.financeTransaction.findFirst({ where: { id: transactionId, branchId }, select: transactionSelect });
    if (!transaction) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction was not found in this branch' } });
    return res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Finance transaction retrieval failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve financial transaction' } });
  }
});

router.post(
  '/:transactionId/decision',
  requirePermission('finance.approve') as any,
  body('decision').isIn(['APPROVE', 'REJECT']),
  body('reason').if(body('decision').equals('REJECT')).isString().trim().isLength({ min: 3, max: 500 }),
  async (req: FinanceRequest, res) => {
    const errors = validationResult(req);
    const branchId = activeBranch(req, res);
    const transactionId = positiveId(req.params.transactionId);
    if (branchId === null) return;
    if (transactionId === null || !errors.isEmpty()) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Provide a valid transaction ID and an APPROVE or REJECT decision; rejection requires a reason' } });
    }
    try {
      const existing = await prisma.financeTransaction.findFirst({
        where: { id: transactionId, branchId },
        select: { id: true, status: true, recordedById: true },
      });
      if (!existing) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction was not found in this branch' } });
      if (existing.status !== 'PENDING') {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_DECIDED', message: 'Only pending transactions can be decided' } });
      }
      if (req.body.decision === 'APPROVE' && existing.recordedById === req.user!.id) {
        return res.status(403).json({ success: false, error: { code: 'SELF_APPROVAL_FORBIDDEN', message: 'A transaction recorder cannot approve their own transaction' } });
      }
      const nextStatus = req.body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const updated = await prisma.financeTransaction.updateMany({
        where: { id: transactionId, branchId, status: 'PENDING' },
        data: {
          status: nextStatus,
          approvedById: req.user!.id,
          approvedAt: new Date(),
          rejectionReason: nextStatus === 'REJECTED' ? req.body.reason.trim() : null,
        },
      });
      if (updated.count !== 1) return res.status(409).json({ success: false, error: { code: 'ALREADY_DECIDED', message: 'This transaction has already been decided' } });
      const transaction = await prisma.financeTransaction.findUnique({ where: { id: transactionId }, select: transactionSelect });
      return res.json({ success: true, data: transaction });
    } catch (error) {
      console.error('Finance decision failed', error);
      return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to decide financial transaction' } });
    }
  },
);

export default router;
