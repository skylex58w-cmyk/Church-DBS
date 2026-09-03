import { Router } from 'express';
import jwt from 'jsonwebtoken';

export function rbac(needed: string) {
  return (req: any, res: any, next: any) => {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token' } });
    const token = auth.split(' ')[1];
    try {
      const payload: any = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
      // TODO: load user roles and permissions from DB and check for needed permission
      // For scaffold, we allow any authenticated user
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  };
}
