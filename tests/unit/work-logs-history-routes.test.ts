import express from 'express';
import request from 'supertest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mockRows = Array.from({ length: 1001 }, (_, id) => ({
  id,
  userId: 'user-1',
  workDate: '2026-10-06T12:00:00Z',
  hours: 1,
  minutes: 0,
}));
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockSelect = jest.fn(() => ({
  from: () => ({
    where: (condition: unknown) => {
      mockWhere(condition);
      return {
        orderBy: (...order: unknown[]) => {
          mockOrderBy(...order);
          return Promise.resolve(mockRows);
        },
      };
    },
  }),
}));

jest.mock('../../server/db', () => ({
  db: { select: () => mockSelect() },
}));
jest.mock('../../server/middleware/auth', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireOwnershipPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../server/storage', () => ({ storage: {} }));

import router from '../../server/routes/work-logs';

function appFor(user?: object) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user as Express.User;
    next();
  });
  app.use('/api/work-logs', router);
  return app;
}

beforeEach(() => jest.clearAllMocks());

it('loads more than one page in a single ordered SELECT scoped to the user', async () => {
  const app = appFor({ id: 'user-1', permissions: ['WORK_LOGS_ADD'] });
  const response = await request(app).get('/api/work-logs?fullHistory=true');
  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(1001);
  expect(response.body).toMatchObject({ total: 1001, offset: 0, hasMore: false });
  expect(mockSelect).toHaveBeenCalledTimes(1);
  const dialect = new PgDialect();
  expect(dialect.sqlToQuery(mockWhere.mock.calls[0][0]).params).toEqual(['user-1']);
  const order = mockOrderBy.mock.calls[0].map((sql) => dialect.sqlToQuery(sql).sql);
  expect(order).toEqual(['"work_logs"."work_date" desc', '"work_logs"."id" desc']);
});

it('allows view-all users to load the authorized full history', async () => {
  const app = appFor({ id: 'admin-1', permissions: ['WORK_LOGS_VIEW_ALL'] });
  const response = await request(app).get('/api/work-logs?fullHistory=true');
  expect(response.status).toBe(200);
  expect(mockWhere).toHaveBeenCalledWith(undefined);
  expect(mockSelect).toHaveBeenCalledTimes(1);
});

it('does not query history without authentication or work-log permission', async () => {
  expect((await request(appFor()).get('/api/work-logs?fullHistory=true')).status).toBe(401);
  expect((await request(appFor({ id: 'user-1', permissions: [] })).get('/api/work-logs?fullHistory=true')).status).toBe(403);
  expect(mockSelect).not.toHaveBeenCalled();
});
