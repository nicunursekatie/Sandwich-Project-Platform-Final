import { Router } from 'express';
import weeklyCollectionsRouter from './weekly-collections';

const reportsRouter = Router();

reportsRouter.use('/weekly-collections', weeklyCollectionsRouter);

export default reportsRouter;
