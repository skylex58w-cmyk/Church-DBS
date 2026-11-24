import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import UsersService from '../users/users.service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = Router();
const svc = new UsersService();

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and contain at least 32 characters');
  }
  return secret;
}

// Public self-service registration is intentionally disabled. User creation is restricted
// to authenticated administrators through /users.
router.post('/register', (_req, res) => {
  return res.status(403).json({
    success: false,
    error: { code: 'REGISTRATION_DISABLED', message: 'Public registration is disabled' },
  });
});

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
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

      const validPassword = await bcrypt.compare(req.body.password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_FAILED', message: 'Invalid credentials' },
        });
      }

      const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];
      const token = jwt.sign(
        { email: user.email },
        jwtSecret(),
        { subject: String(user.id), expiresIn, algorithm: 'HS256' },
      );

      return res.json({ success: true, data: { token, tokenType: 'Bearer', expiresIn } });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('JWT_SECRET')) {
        console.error(err.message);
        return res.status(500).json({
          success: false,
          error: { code: 'SERVER_CONFIGURATION_ERROR', message: 'Authentication is not configured' },
        });
      }
      console.error('Login failed', err);
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Unable to complete login' },
      });
    }
  },
);

export default router;
