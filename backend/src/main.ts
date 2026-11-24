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
app.use(express.json({ limit: '1mb' }));
app.use('/api/v1', appRouter);

// Register admin routes (RBAC admin endpoints).
registerAdminRoutes(app);

const port = Number(process.env.PORT) || 3000;
createServer(app).listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
