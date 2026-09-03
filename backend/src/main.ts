import express from 'express';
import { json } from 'body-parser';
import { createServer } from 'http';
import { appRouter } from './routes';

const app = express();
app.use(json());
app.use('/api/v1', appRouter);

const port = process.env.PORT || 3000;
createServer(app).listen(port, () => {
  console.log(`Backend server running on port ${port}`);
});
