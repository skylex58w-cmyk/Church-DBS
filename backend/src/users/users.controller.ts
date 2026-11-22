import { Router } from 'express';
import UsersService from './users.service';
import { body, validationResult } from 'express-validator';

const router = Router();
const svc = new UsersService();

router.get('/', async (_req, res) => {
  const users = await svc.findAll();
  res.json({ success: true, data: users });
});

router.post(
  '/',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
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
      return res.json({
        success: true,
        data: { id: user.id, email: user.email },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error';
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message },
      });
    }
  },
);

export default router;
