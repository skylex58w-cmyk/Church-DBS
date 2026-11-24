import express from 'express';
import { createServer } from 'http';
import { appRouter } from './routes';
import { registerAdminRoutes } from './routes/registerAdminRoutes';

const app = express();

app.use(express.json());
app.use('/api/v1', appRouter);

// Register admin routes (RBAC admin endpoints)
registerAdminRoutes(app);

const port = Number(process.env.PORT) || 3000;
createServer(app).listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
