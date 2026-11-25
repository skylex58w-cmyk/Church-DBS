import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import UsersService from '../users/users.service';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const router = Router();
const svc = new UsersService();
const prisma = new PrismaClient();

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be configured and contain at least 32 characters');
  }
  return secret;
}

function refreshTokenTtlMs(): number {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
  if (!Number.isSafeInteger(days) || days < 1 || days > 365) {
    throw new Error('REFRESH_TOKEN_TTL_DAYS must be an integer between 1 and 365');
  }
  return days * 24 * 60 * 60 * 1000;
}

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

function accessTokenFor(user: { id: number; email: string }) {
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1h') as jwt.SignOptions['expiresIn'];
  const token = jwt.sign(
    { email: user.email },
    jwtSecret(),
    { subject: String(user.id), expiresIn, algorithm: 'HS256' },
  );
  return { token, tokenType: 'Bearer', expiresIn };
}

function validRefreshToken(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 40 && value.length <= 256;
}

function authConfigurationError(res: any) {
  return res.status(500).json({
    success: false,
    error: { code: 'SERVER_CONFIGURATION_ERROR', message: 'Authentication is not configured' },
  });
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

      const access = accessTokenFor(user);
      const refreshToken = newRefreshToken();
      const now = new Date();
      await prisma.refreshToken.create({
        data: {
          tokenHash: hashRefreshToken(refreshToken),
          familyId: randomUUID(),
          userId: user.id,
          expiresAt: new Date(now.getTime() + refreshTokenTtlMs()),
        },
      });

      return res.json({
        success: true,
        data: { ...access, refreshToken, refreshTokenExpiresIn: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 86400 },
      });
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.startsWith('JWT_SECRET') || err.message.startsWith('REFRESH_TOKEN_TTL_DAYS'))) {
        console.error(err.message);
        return authConfigurationError(res);
      }
      console.error('Login failed', err);
      return res.status(500).json({
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Unable to complete login' },
      });
    }
  },
);

router.post('/refresh', async (req, res) => {
  const presentedToken = req.body?.refreshToken;
  if (!validRefreshToken(presentedToken)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'A valid refresh token is required' },
    });
  }

  try {
    const tokenHash = hashRefreshToken(presentedToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!stored) {
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_INVALID', message: 'Refresh token is invalid' },
      });
    }

    const now = new Date();
    if (stored.revokedAt) {
      // A previously rotated token was replayed. Revoke every still-active token
      // in the family so the stolen token cannot continue refreshing the session.
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_REUSE', message: 'Refresh token reuse detected; sign in again' },
      });
    }

    if (stored.expiresAt <= now) {
      await prisma.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: now },
      });
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token has expired; sign in again' },
      });
    }

    const nextRefreshToken = newRefreshToken();
    const nextTokenHash = hashRefreshToken(nextRefreshToken);
    const nextExpiry = new Date(now.getTime() + refreshTokenTtlMs());

    const rotated = await prisma.$transaction(async (tx) => {
      const update = await tx.refreshToken.updateMany({
        where: { id: stored.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, replacedByTokenHash: nextTokenHash },
      });
      if (update.count !== 1) return false;
      await tx.refreshToken.create({
        data: {
          tokenHash: nextTokenHash,
          familyId: stored.familyId,
          userId: stored.userId,
          expiresAt: nextExpiry,
        },
      });
      return true;
    });

    if (!rotated) {
      // A concurrent refresh already consumed this token. Treat it as replay.
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      return res.status(401).json({
        success: false,
        error: { code: 'REFRESH_TOKEN_REUSE', message: 'Refresh token reuse detected; sign in again' },
      });
    }

    const access = accessTokenFor(stored.user);
    return res.json({
      success: true,
      data: {
        ...access,
        refreshToken: nextRefreshToken,
        refreshTokenExpiresIn: Math.floor(refreshTokenTtlMs() / 1000),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.startsWith('JWT_SECRET') || err.message.startsWith('REFRESH_TOKEN_TTL_DAYS'))) {
      console.error(err.message);
      return authConfigurationError(res);
    }
    console.error('Refresh token rotation failed', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to refresh session' },
    });
  }
});

router.post('/logout', async (req, res) => {
  const presentedToken = req.body?.refreshToken;
  if (!validRefreshToken(presentedToken)) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'A valid refresh token is required' },
    });
  }

  try {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(presentedToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Idempotent response avoids revealing whether a supplied token existed.
    return res.json({ success: true, data: { loggedOut: true } });
  } catch (err) {
    console.error('Logout failed', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to complete logout' },
    });
  }
});

export default router;
