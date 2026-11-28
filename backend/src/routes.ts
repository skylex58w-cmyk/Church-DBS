import express from 'express';
import usersRouter from './users/users.controller';
import authRouter from './auth/auth.controller';
import branchesRouter from './branches/branches.controller';
import membersRouter from './members/members.controller';
import attendanceRouter from './attendance/attendance.controller';
import financeRouter from './finance/finance.controller';

import { Router } from 'express';

export const appRouter = Router();
appRouter.use('/auth', authRouter);
appRouter.use('/users', usersRouter);
appRouter.use('/branches', branchesRouter);
appRouter.use('/members', membersRouter);
appRouter.use('/attendance', attendanceRouter);
appRouter.use('/finance', financeRouter);

export default appRouter;
