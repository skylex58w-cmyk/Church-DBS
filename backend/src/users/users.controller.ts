import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import UsersService from './users.service';
import { requirePermission } from '../rbac/requirePermission';

const router = Router();
const svc = new UsersService();

router.get('/', requirePermission('users.manage') as any, async (_req, res) => {
  try {
    const users = await svc.findAll();
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

export default router;
