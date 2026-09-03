import express from 'express';
import adminRouter from './admin.permissions';

export function registerAdminRoutes(app: express.Application) {
  // Mount admin routes under /api/v1/admin
  app.use('/api/v1/admin', adminRouter);
}
