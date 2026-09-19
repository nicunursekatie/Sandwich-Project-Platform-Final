/**
 * Route tests for the "Start Work / Stop Work" stopwatch endpoints.
 * The database is replaced with a tiny in-memory stand-in so the request/response
 * contract and the '/timer' vs '/:id' route ordering can be exercised without Postgres.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { workLogs, workLogTimers } from '../../shared/schema';

const mockTimerRows: any[] = [];
const mockWorkLogRows: any[] = [];
let mockNextId = 1;
let failTimerStop = false;
let mockFreshUser: any = {
  id: 'user-1',
  email: 'katie@example.org',
  role: 'volunteer',
  permissions: ['WORK_LOGS_ADD'],
  isActive: true,
};
let mockGetUserError: Error | null = null;

function mockRowsFor(table: any): any[] {
  if (table === workLogTimers) return mockTimerRows;
  if (table === workLogs) return mockWorkLogRows;
  throw new Error('Unexpected table in work log timer test');
}

const mockDb = {
  select: () => ({
    from: (table: any) => {
      const settle = () => Promise.resolve(mockRowsFor(table).slice());
      const chain: any = {
        where: settle,
        orderBy: () => chain,
        limit: () => chain,
        offset: () => chain,
        then: (onOk: any, onErr: any) => settle().then(onOk, onErr),
      };
      return chain;
    },
  }),
  insert: (table: any) => ({
    values: (values: any) => {
      const rows = mockRowsFor(table);
      const insert = () => {
        const row = { id: mockNextId++, ...values };
        rows.push(row);
        return row;
      };
      return {
        returning: () => Promise.resolve([insert()]),
        onConflictDoNothing: () => ({
          returning: () =>
            Promise.resolve(
              rows.some((r) => r.userId === values.userId) ? [] : [insert()]
            ),
        }),
      };
    },
  }),
  delete: (table: any) => ({
    where: () => {
      const rows = mockRowsFor(table);
      const removed = rows.splice(0, rows.length);
      const promise: any = Promise.resolve(undefined);
      promise.returning = () => Promise.resolve(removed);
      return promise;
    },
  }),
  update: (table: any) => ({
    set: (values: any) => ({
      where: () => ({
        returning: () => {
          const rows = mockRowsFor(table);
          const row = rows[0];
          if (!row) return Promise.resolve([]);
          Object.assign(row, values);
          return Promise.resolve([row]);
        },
      }),
    }),
  }),
};

const executeRawSql = (query: any) => {
    if (failTimerStop) {
      return Promise.reject(new Error('Unable to write work log'));
    }

    const timer = mockTimerRows[0];
    if (!timer) {
      return Promise.resolve(null);
    }

    const stringParams = query.queryChunks.filter(
      (chunk: unknown): chunk is string => typeof chunk === 'string'
    );
    const stopDescription = stringParams.find((value) => value !== 'user-1')?.trim();
    const elapsedSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 1000)
    );
    const rawMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    const totalMinutes = Math.min(rawMinutes, 24 * 60);
    const log = {
      id: mockNextId++,
      userId: timer.userId,
      description: stopDescription || timer.description || 'Work logged',
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
      workDate: timer.startedAt,
    };

    mockWorkLogRows.push(log);
    mockTimerRows.splice(0, 1);
    return Promise.resolve({
      log,
      elapsedSeconds,
      capped: rawMinutes > 24 * 60,
    });
  };

// A getter, because jest hoists this factory above the imports and `mockDb` is
// not initialized until the test module body runs.
jest.mock('../../server/db', () => ({
  get db() {
    return mockDb;
  },
  executeRawSql: (query: any) =>
    executeRawSql(query).then((result) => (result ? [result] : [])),
}));

jest.mock('../../server/middleware/auth', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  requireOwnershipPermission: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../server/storage', () => ({
  get storage() {
    return {
      getUser: (_id: string) => {
        if (mockGetUserError) return Promise.reject(mockGetUserError);
        return Promise.resolve(mockFreshUser);
      },
    };
  },
}));

import workLogsRouter from '../../server/routes/work-logs';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-1', email: 'katie@example.org', role: 'volunteer' };
    next();
  });
  app.use('/api/work-logs', workLogsRouter);
  return app;
}

describe('work log timer routes', () => {
  beforeEach(() => {
    mockTimerRows.length = 0;
    mockWorkLogRows.length = 0;
    mockNextId = 1;
    failTimerStop = false;
    mockGetUserError = null;
    mockFreshUser = {
      id: 'user-1',
      email: 'katie@example.org',
      role: 'volunteer',
      permissions: ['WORK_LOGS_ADD'],
      isActive: true,
    };
  });

  it('reports no running timer by default', async () => {
    const res = await request(makeApp()).get('/api/work-logs/timer');
    expect(res.status).toBe(200);
    expect(res.body.timer).toBeNull();
  });

  it('starts a timer and reports it as running', async () => {
    const app = makeApp();
    const start = await request(app)
      .post('/api/work-logs/timer/start')
      .send({ description: 'Sorting deliveries' });
    expect(start.status).toBe(201);
    expect(start.body.timer.description).toBe('Sorting deliveries');

    const status = await request(app).get('/api/work-logs/timer');
    expect(status.body.timer.userId).toBe('user-1');
  });

  it('refuses to start a second timer', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({});
    const second = await request(app).post('/api/work-logs/timer/start').send({});
    expect(second.status).toBe(409);
    expect(mockTimerRows).toHaveLength(1);
  });

  it('turns the elapsed time into a work log entry on stop', async () => {
    const app = makeApp();
    await request(app)
      .post('/api/work-logs/timer/start')
      .send({ description: 'Sorting deliveries' });

    // Pretend the timer has been running for 90 minutes.
    mockTimerRows[0].startedAt = new Date(Date.now() - 90 * 60 * 1000);

    const stop = await request(app).post('/api/work-logs/timer/stop').send({});
    expect(stop.status).toBe(201);
    expect(stop.body.capped).toBe(false);
    expect(stop.body.log).toMatchObject({
      userId: 'user-1',
      hours: 1,
      minutes: 30,
      description: 'Sorting deliveries',
    });
    expect(mockTimerRows).toHaveLength(0);
    expect(mockWorkLogRows).toHaveLength(1);
  });

  it('prefers a description supplied at stop time', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({ description: 'Guess' });
    const stop = await request(app)
      .post('/api/work-logs/timer/stop')
      .send({ description: 'Actually packed boxes' });
    expect(stop.body.log.description).toBe('Actually packed boxes');
  });

  it('falls back to a default description when none is given', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({});
    const stop = await request(app).post('/api/work-logs/timer/stop').send({});
    expect(stop.body.log.description).toBe('Work logged');
  });

  it('returns 404 when stopping with no timer running', async () => {
    const stop = await request(makeApp()).post('/api/work-logs/timer/stop').send({});
    expect(stop.status).toBe(404);
    expect(mockWorkLogRows).toHaveLength(0);
  });

  it('keeps the timer running when creating the work log fails', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({});
    failTimerStop = true;

    const stop = await request(app).post('/api/work-logs/timer/stop').send({});
    expect(stop.status).toBe(500);
    expect(mockTimerRows).toHaveLength(1);
    expect(mockWorkLogRows).toHaveLength(0);
  });

  it('discards a timer without creating an entry', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({});
    const discard = await request(app).delete('/api/work-logs/timer');
    expect(discard.status).toBe(204);
    expect(mockTimerRows).toHaveLength(0);
    expect(mockWorkLogRows).toHaveLength(0);
  });

  it('does not let the /:id delete route swallow /timer', async () => {
    const app = makeApp();
    await request(app).post('/api/work-logs/timer/start').send({});
    const discard = await request(app).delete('/api/work-logs/timer');
    expect(discard.status).not.toBe(400);

    const badId = await request(app).delete('/api/work-logs/not-a-number');
    expect(badId.status).toBe(400);
  });
});

const validUpdate = {
  description: 'Updated work',
  hours: 2,
  minutes: 15,
  workDate: '2026-09-16T12:00:00',
};

function seedWorkLog(overrides: Record<string, unknown> = {}) {
  const row = {
    id: mockNextId++,
    userId: 'user-1',
    description: 'Work logged',
    hours: 1,
    minutes: 30,
    workDate: new Date('2026-09-16T12:00:00'),
    ...overrides,
  };
  mockWorkLogRows.push(row);
  return row;
}

describe('work log update route', () => {
  beforeEach(() => {
    mockTimerRows.length = 0;
    mockWorkLogRows.length = 0;
    mockNextId = 1;
    mockGetUserError = null;
    mockFreshUser = {
      id: 'user-1',
      email: 'katie@example.org',
      role: 'volunteer',
      permissions: ['WORK_LOGS_ADD'],
      isActive: true,
    };
  });

  it('lets an owner with WORK_LOGS_ADD update their entry', async () => {
    const log = seedWorkLog();
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: log.id,
      description: 'Updated work',
      hours: 2,
      minutes: 15,
    });
  });

  it('lets an owner with WORK_LOGS_EDIT_OWN update their entry', async () => {
    mockFreshUser.permissions = ['WORK_LOGS_EDIT_OWN'];
    const log = seedWorkLog();
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated work');
  });

  it('rejects a non-owner without edit-all permission', async () => {
    const log = seedWorkLog({ userId: 'other-user' });
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(403);
    expect(log.description).toBe('Work logged');
  });

  it('lets WORK_LOGS_EDIT_ALL update another user\'s entry', async () => {
    mockFreshUser.permissions = ['WORK_LOGS_EDIT_ALL'];
    const log = seedWorkLog({ userId: 'other-user' });
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated work');
  });

  it('lets a super admin update another user\'s entry', async () => {
    mockFreshUser.role = 'super_admin';
    mockFreshUser.permissions = [];
    const log = seedWorkLog({ userId: 'other-user' });
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(200);
    expect(res.body.description).toBe('Updated work');
  });

  it('fails closed when the fresh-user lookup errors', async () => {
    mockGetUserError = new Error('database unavailable');
    const log = seedWorkLog();
    const res = await request(makeApp())
      .put(`/api/work-logs/${log.id}`)
      .send(validUpdate);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Unable to verify user permissions');
    expect(log.description).toBe('Work logged');
  });
});
