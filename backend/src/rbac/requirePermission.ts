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
      if (!auth) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });

      const payload: any = jwt.verify(auth, process.env.JWT_SECRET || 'dev_jwt_secret');

      const user = await prisma.user.findUnique({
        where: { id: Number(payload.sub) || payload.sub },
        include: { roles: { include: { role: { include: { rolePermission: { include: { permission: true } } } } } } }
      });

      if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid user' } });

      // compute permission set
      const permissionSet = new Set<string>();
      const scopedPermissions: Array<{ name: string; branchId?: number }> = [];

      for (const ur of user.roles) {
        const role = ur.role;
        for (const rp of role.rolePermission) {
          permissionSet.add(rp.permission.name);
          scopedPermissions.push({ name: rp.permission.name, branchId: rp.branchId || ur.branchId || undefined });
        }
      }

      const hasPermission = permissionSet.has(permissionName);

      if (!hasPermission) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permission' } });
      }

      // attach minimal user context
      req.user = { id: user.id, email: user.email, permissions: Array.from(permissionSet), scopes: scopedPermissions };

      // Audit hook placeholder: record that user checked permission (real audit implemented elsewhere)

      return next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token expired' } });
      }
      console.error('RBAC middleware error', err);
      return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Authorization failure' } });
    }
  };
}
