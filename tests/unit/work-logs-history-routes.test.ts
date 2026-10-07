import express from 'express';
import request from 'supertest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mockRows = Array.from({ length: 1001 }, (_, id) => ({
  id: 1001 - id,
  userId: 'user-1',
  workDate: new Date('2026-10-06T12:00:00Z'),
  cursorDate: '2026-10-06T12:00:00.000123Z',
  hours: 1,
  minutes: 0,
}));
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockSelect = jest.fn(() => ({
  from: () => ({
    where: (condition: unknown) => {
      mockWhere(condition);
      return {
        orderBy: (...order: unknown[]) => {
          mockOrderBy(...order);
          return {
            limit: (limit: number) => {
              mockLimit(limit);
              return Promise.resolve(mockRows.slice(0, limit));
            },
          };
        },
      };
    },
  }),
}));
const mockReport = {
  totals: { week: 60060, month: 60060, all: 60060 },
  currentWeek: '2026-10-05',
  groups: Array.from({ length: 51 }, (_, index) => ({
    key: `week-${index}`,
    minutes: 60,
    count: 1,
  })),
};
const mockExecute = jest.fn(async (_query: unknown) => [mockReport]);
jest.mock('../../server/db', () => ({
  db: { select: () => mockSelect() },
  executeRawSql: (query: unknown) => mockExecute(query),
}));
jest.mock('../../server/middleware/auth', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
  requireOwnershipPermission:
    () => (_req: unknown, _res: unknown, next: () => void) =>
      next(),
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
const ownUser = { id: 'user-1', permissions: ['WORK_LOGS_ADD'] };
const dialect = new PgDialect();
beforeEach(() => jest.clearAllMocks());

it('returns full-history totals with at most 50 headings from a single aggregate query', async () => {
  const response = await request(appFor(ownUser)).get(
    '/api/work-logs?summary=true'
  );
  expect(response.status).toBe(200);
  expect(response.body.totals.all).toBe(60060);
  expect(response.body.groups).toHaveLength(50);
  expect(response.body.nextWeek).toBe('week-49');
  expect(mockExecute).toHaveBeenCalledTimes(1);
  expect(mockSelect).not.toHaveBeenCalled();
  const query = dialect.sqlToQuery(mockExecute.mock.calls[0][0] as any);
  expect(query.params).toContain('user-1');
  expect(query.sql).toContain('LIMIT 51');
  expect(query.sql).toContain("AT TIME ZONE 'America/New_York'");
  expect(query.sql).toContain("date_trunc('week', today)::date AS week");
  expect(query.sql).toContain("SELECT date_trunc('week', day)::date AS week");
  expect(query.sql).not.toContain("interval '2 days'");
});

it('uses a week cursor without narrowing the all-time aggregate', async () => {
  await request(appFor(ownUser)).get(
    '/api/work-logs?summary=true&beforeWeek=2026-09-28'
  );
  const query = dialect.sqlToQuery(mockExecute.mock.calls[0][0] as any);
  expect(query.params).toEqual(['user-1', '2026-09-28']);
  expect(query.sql).toMatch(/SELECT \* FROM weeks\s+WHERE week </);
});

it('bounds week entries and returns a stable timestamp/ID cursor', async () => {
  const response = await request(appFor(ownUser)).get(
    '/api/work-logs?week=2026-10-05'
  );
  expect(response.status).toBe(200);
  expect(response.body.data).toHaveLength(100);
  expect(response.body.nextCursor).toEqual({
    date: '2026-10-06T12:00:00.000123Z',
    id: 902,
  });
  expect(mockLimit).toHaveBeenCalledWith(101);
  const order = mockOrderBy.mock.calls[0].map(
    (sql) => dialect.sqlToQuery(sql).sql
  );
  expect(order).toEqual([
    '"work_logs"."work_date" desc',
    '"work_logs"."id" desc',
  ]);
  expect(dialect.sqlToQuery(mockWhere.mock.calls[0][0]).params).toContain(
    'user-1'
  );
});

it('filters tied timestamps by ID on the next entry page', async () => {
  const response = await request(appFor(ownUser)).get(
    '/api/work-logs?week=2026-10-05&beforeDate=2026-10-06T12:00:00Z&beforeId=902'
  );
  expect(response.status).toBe(200);
  const query = dialect.sqlToQuery(mockWhere.mock.calls[0][0]);
  expect(query.sql).toContain('"work_logs"."id" <');
  expect(query.params).toContain(902);
});

it('allows view-all summaries without imposing an owner filter', async () => {
  const response = await request(
    appFor({ id: 'admin-1', permissions: ['WORK_LOGS_VIEW_ALL'] })
  ).get('/api/work-logs?summary=true');
  expect(response.status).toBe(200);
  expect(
    dialect.sqlToQuery(mockExecute.mock.calls[0][0] as any).params
  ).not.toContain('admin-1');
});

it('rejects malformed cursors and dates before querying', async () => {
  for (const params of [
    'summary=true&beforeWeek=bad',
    'week=2026-10-06',
    'week=2026-10-05&beforeDate=bad&beforeId=1',
  ]) {
    expect(
      (await request(appFor(ownUser)).get(`/api/work-logs?${params}`)).status
    ).toBe(400);
  }
  expect(mockExecute).not.toHaveBeenCalled();
  expect(mockSelect).not.toHaveBeenCalled();
});

it('rejects unauthenticated and unauthorized summary requests', async () => {
  expect(
    (await request(appFor()).get('/api/work-logs?summary=true')).status
  ).toBe(401);
  expect(
    (
      await request(appFor({ id: 'user-1', permissions: [] })).get(
        '/api/work-logs?summary=true'
      )
    ).status
  ).toBe(403);
  expect(mockExecute).not.toHaveBeenCalled();
});
