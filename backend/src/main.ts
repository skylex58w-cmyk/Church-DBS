import express from 'express';
import { createServer } from 'http';
import { appRouter } from './routes';
import { registerAdminRoutes } from './routes/registerAdminRoutes';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('Startup blocked: JWT_SECRET must be configured and contain at least 32 characters');
}

const app = express();
app.disable('x-powered-by');

// Credentialed CORS is restricted to explicitly configured frontend origins.
const allowedOrigins = (process.env.AUTH_ALLOWED_ORIGINS || '')
  .split(',').map((value) => value.trim()).filter(Boolean);
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Branch-Id');
  }
  if (req.method === 'OPTIONS') {
    if (!origin || !allowedOrigins.includes(origin)) {
      return res.status(403).end();
    }
    return res.status(204).end();
  }
  return next();
});
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', appRouter);

// Register admin routes (RBAC admin endpoints).
registerAdminRoutes(app);

const port = Number(process.env.PORT) || 3000;
createServer(app).listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
