import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    branchId: number | null;
    permissions: string[];
  };
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and contain at least 32 characters');
  }
  return secret;
}

function requestedBranchId(req: Request): number | null | undefined {
  const raw = req.params.branchId ?? req.header('x-branch-id');
  if (raw === undefined) return null;
  if (!/^\d+$/.test(raw)) return undefined;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

export function requirePermission(permissionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authorization = req.header('authorization');
      const [scheme, token, extra] = authorization?.trim().split(/\s+/) ?? [];
      if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required' },
        });
      }

      let payload: jwt.JwtPayload;
      try {
        const verified = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
        if (typeof verified === 'string' || !verified.sub) throw new Error('Invalid token payload');
        payload = verified;
      } catch {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
      }

      const userId = Number(payload.sub);
      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token subject' },
        });
      }

      const branchId = requestedBranchId(req);
      if (branchId === undefined) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_BRANCH', message: 'Branch ID must be a positive integer' },
        });
      }
      if (branchId !== null) {
        const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
        if (!branch) {
          return res.status(404).json({
            success: false,
            error: { code: 'BRANCH_NOT_FOUND', message: 'The requested branch does not exist' },
          });
        }
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          roles: {
            select: {
              branchId: true,
              role: {
                select: {
                  rolePermission: {
                    select: {
                      branchId: true,
                      permission: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid user' },
        });
      }

      const granted = new Set<string>();
      for (const assignment of user.roles) {
        const assignmentMatches = branchId === null
          ? assignment.branchId === null
          : assignment.branchId === null || assignment.branchId === branchId;
        if (!assignmentMatches) continue;

        for (const grant of assignment.role.rolePermission) {
          const grantMatches = branchId === null
            ? grant.branchId === null
            : grant.branchId === null || grant.branchId === branchId;
          if (grantMatches) granted.add(grant.permission.name);
        }
      }

      if (!granted.has(permissionName)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permission for the requested scope' },
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        branchId,
        permissions: Array.from(granted),
      };
      return next();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('JWT_SECRET')) {
        console.error(err.message);
        return res.status(500).json({
          success: false,
          error: { code: 'SERVER_CONFIGURATION_ERROR', message: 'Authentication is not configured' },
        });
      }
      console.error('RBAC middleware error', err);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Authorization failure' },
      });
    }
  };
}
