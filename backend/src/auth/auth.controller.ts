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

const REFRESH_COOKIE = 'chms_refresh';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: REFRESH_COOKIE_PATH,
  };
}

function setRefreshCookie(res: any, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions(),
    maxAge: refreshTokenTtlMs(),
  });
}

function clearRefreshCookie(res: any) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions());
}

function readRefreshCookie(req: any): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== 'string') return undefined;
  const entry = header.split(';').map((part: string) => part.trim())
    .find((part: string) => part.startsWith(REFRESH_COOKIE + '='));
  if (!entry) return undefined;
  try { return decodeURIComponent(entry.slice(REFRESH_COOKIE.length + 1)); }
  catch { return undefined; }
}

function trustedCookieRequest(req: any): boolean {
  const origin = req.get('origin');
  const configured = (process.env.AUTH_ALLOWED_ORIGINS || '')
    .split(',').map((value: string) => value.trim()).filter(Boolean);
  // Cookie-authenticated endpoints require an explicit browser Origin and allowlist.
  return typeof origin === 'string' && configured.includes(origin);
}

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

      setRefreshCookie(res, refreshToken);
      return res.json({
        success: true,
        data: { ...access, refreshTokenExpiresIn: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 86400 },
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


router.get('/me', async (req, res) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token, extra] = authorization.trim().split(/\\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'A valid bearer token is required' },
    });
  }

  try {
    const verified = jwt.verify(token, jwtSecret(), { algorithms: ['HS256'] });
    if (typeof verified === 'string' || !verified.sub) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid access token' },
      });
    }
    const userId = Number(verified.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid access token subject' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        roles: {
          select: {
            branchId: true,
            branch: { select: { id: true, name: true, code: true } },
            role: { select: { id: true, name: true, description: true } },
          },
          orderBy: [{ branchId: 'asc' }, { roleId: 'asc' }],
        },
      },
    });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User account is no longer available' },
      });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        roleAssignments: user.roles.map((assignment) => ({
          branchId: assignment.branchId,
          branch: assignment.branch,
          role: assignment.role,
        })),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('JWT_SECRET')) {
      return authConfigurationError(res);
    }
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired access token' },
      });
    }
    console.error('Current-user lookup failed', err);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Unable to retrieve current user' },
    });
  }
});

router.post('/refresh', async (req, res) => {
  if (!trustedCookieRequest(req)) {
    return res.status(403).json({ success: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed' } });
  }
  const presentedToken = readRefreshCookie(req);
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
    setRefreshCookie(res, nextRefreshToken);
    return res.json({
      success: true,
      data: { ...access, refreshTokenExpiresIn: Math.floor(refreshTokenTtlMs() / 1000) },
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
  if (!trustedCookieRequest(req)) {
    return res.status(403).json({ success: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed' } });
  }
  const presentedToken = readRefreshCookie(req);
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
    clearRefreshCookie(res);
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
