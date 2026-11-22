import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import UsersService from '../users/users.service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = Router();
const svc = new UsersService();

router.post(
  '/register',
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

router.post(
  '/login',
  body('email').isEmail(),
  body('password').exists(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: errors.array() },
      });
    }

    try {
      const user = await svc.findByEmail(req.body.email);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
        });
      }

      const validPassword = await bcrypt.compare(
        req.body.password,
        user.passwordHash,
      );
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
        });
      }

      const expiresIn = (process.env.JWT_EXPIRES_IN ||
        '1h') as jwt.SignOptions['expiresIn'];
      const token = jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET || 'dev_secret',
        { expiresIn },
      );

      return res.json({ success: true, data: { token } });
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
