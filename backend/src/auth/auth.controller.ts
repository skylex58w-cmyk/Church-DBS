import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import UsersService from '../users/users.service';
import jwt from 'jsonwebtoken';

const router = Router();
const svc = new UsersService();

router.post('/register', body('email').isEmail(), body('password').isLength({ min: 6 }), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  try {
    const u = await svc.create(req.body.email, req.body.password);
    res.json({ success: true, data: { id: u.id, email: u.email } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

router.post('/login', body('email').isEmail(), body('password').exists(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  try {
    const user = await svc.findByEmail(req.body.email);
    if (!user) return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } });
    const bcrypt = await import('bcrypt');
    const ok = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } });
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
    res.json({ success: true, data: { token } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

export default router;
