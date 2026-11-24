import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: any;
}

export function requirePermission(permissionName: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const auth = req.headers.authorization?.split(' ')[1];
      if (!auth) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing token' },
        });
      }

      const payload = jwt.verify(auth, process.env.JWT_SECRET || 'dev_jwt_secret');
      const subject = typeof payload === 'string' ? undefined : payload.sub;
      const userId = Number(subject);

      if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token subject' },
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  rolePermission: { include: { permission: true } },
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

      // NOTE: branch-scope enforcement is deliberately handled in the RBAC phase.
      const permissionSet = new Set<string>();
      const scopedPermissions: Array<{ name: string; branchId?: number }> = [];

      for (const userRole of user.roles) {
        for (const rolePermission of userRole.role.rolePermission) {
          permissionSet.add(rolePermission.permission.name);
          scopedPermissions.push({
            name: rolePermission.permission.name,
            branchId: rolePermission.branchId ?? userRole.branchId ?? undefined,
          });
        }
      }

      if (!permissionSet.has(permissionName)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permission' },
        });
      }

      req.user = {
        id: user.id,
        email: user.email,
        permissions: Array.from(permissionSet),
        scopes: scopedPermissions,
      };

      return next();
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Token expired' },
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
