import express from 'express';
import usersRouter from './users/users.controller';
import authRouter from './auth/auth.controller';
import branchesRouter from './branches/branches.controller';

import { Router } from 'express';

export const appRouter = Router();
appRouter.use('/auth', authRouter);
appRouter.use('/users', usersRouter);
appRouter.use('/branches', branchesRouter);

export default appRouter;
