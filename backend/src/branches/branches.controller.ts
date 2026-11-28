import { Router, Request } from 'express';
import { PrismaClient } from '@prisma/client';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const prisma = new PrismaClient();

interface BranchRequest extends Request {
  user?: { id: number; email: string; branchId: number | null; permissions: string[] };
}

// Global administrators can list all branches. Branch-scoped administrators must
// request their active branch explicitly and are constrained by requirePermission.
router.get('/', requirePermission('branches.view') as any, async (req: BranchRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator context is missing' } });
    }
    if (req.user.branchId !== null) {
      const branch = await prisma.branch.findUnique({
        where: { id: req.user.branchId },
        select: { id: true, name: true, code: true, createdAt: true },
      });
      if (!branch) {
        return res.status(404).json({ success: false, error: { code: 'BRANCH_NOT_FOUND', message: 'Branch was not found' } });
      }
      return res.json({ success: true, data: [branch] });
    }

    const branches = await prisma.branch.findMany({
      select: { id: true, name: true, code: true, createdAt: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return res.json({ success: true, data: branches });
  } catch (error) {
    console.error('Branch listing failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve branches' } });
  }
});

router.get('/:branchId', requirePermission('branches.view') as any, async (req: BranchRequest, res) => {
  const branchId = Number(req.params.branchId);
  if (!Number.isSafeInteger(branchId) || branchId <= 0) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Branch ID must be a positive integer' } });
  }
  if (!req.user) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Administrator context is missing' } });
  }
  // A branch administrator may inspect only the branch used to authorize this request.
  if (req.user.branchId !== null && req.user.branchId !== branchId) {
    return res.status(403).json({ success: false, error: { code: 'BRANCH_SCOPE_FORBIDDEN', message: 'You cannot access another branch' } });
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, code: true, createdAt: true },
    });
    if (!branch) {
      return res.status(404).json({ success: false, error: { code: 'BRANCH_NOT_FOUND', message: 'Branch was not found' } });
    }
    return res.json({ success: true, data: branch });
  } catch (error) {
    console.error('Branch lookup failed', error);
    return res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Unable to retrieve branch' } });
  }
});

export default router;
