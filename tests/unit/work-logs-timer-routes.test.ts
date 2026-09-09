/**
 * Route tests for the "Start Work / Stop Work" stopwatch endpoints.
 * The database is replaced with a tiny in-memory stand-in so the request/response
 * contract and the '/timer' vs '/:id' route ordering can be exercised without Postgres.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import express from 'express';
import request from 'supertest';

const mockTimerRows: any[] = [];
const mockWorkLogRows: any[] = [];
let mockNextId = 1;

function mockRowsFor(table: any): any[] {
  // Drizzle exposes the SQL table name on a well-known symbol; fall back to a
  // string match so this keeps working if the symbol name changes.
  const name = String(
    Object.getOwnPropertySymbols(table)
      .map((s) => (table as any)[s])
      .find((v) => typeof v === 'string' && v.includes('work_log')) ?? ''
  );
  return name === 'work_log_timers' ? mockTimerRows : mockWorkLogRows;
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
};

// A getter, because jest hoists this factory above the imports and `mockDb` is
// not initialized until the test module body runs.
jest.mock('../../server/db', () => ({
  get db() {
    return mockDb;
  },
}));

jest.mock('../../server/middleware/auth', () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
  requireOwnershipPermission: () => (_req: any, _res: any, next: any) => next(),
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
