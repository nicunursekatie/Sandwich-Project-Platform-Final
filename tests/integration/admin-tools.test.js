const request = require('supertest');

const { app } = require('../../server/index.ts');

const { DataExporter } = require('../../server/data-export.ts');
const { BulkOperationsManager } = require('../../server/bulk-operations.ts');
const { AuditLogger } = require('../../server/audit-logger.ts');

jest.spyOn(DataExporter, 'getDataSummary').mockResolvedValue({
  totalCollections: 0,
  hosts: 0,
});

jest
  .spyOn(BulkOperationsManager, 'validateDataIntegrity')
  .mockResolvedValue({
    issues: [],
    status: 'healthy',
  });

jest
  .spyOn(BulkOperationsManager, 'deduplicateHosts')
  .mockResolvedValue({
    success: true,
    deleted: 2,
    processed: 2,
    errors: [],
  });

jest
  .spyOn(BulkOperationsManager, 'bulkDeleteCollections')
  .mockResolvedValue({
    success: true,
    deleted: 1,
    processed: 1,
    errors: [],
  });

jest
  .spyOn(AuditLogger, 'getAuditHistory')
  .mockResolvedValue([{ id: 1, action: 'test' }]);

describe('Administrative tools API coverage', () => {
  let authCookie;

  beforeAll(async () => {
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@sandwich.project',
      password: 'admin123',
    });

    authCookie = loginResponse.headers['set-cookie'];
  });

  test('GET /api/data-management/summary returns mocked summary', async () => {
    const response = await request(app)
      .get('/api/data-management/summary')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalCollections: 0, hosts: 0 });
    expect(DataExporter.getDataSummary).toHaveBeenCalled();
  });

  test('GET /api/data-management/integrity/check returns mocked status', async () => {
    const response = await request(app)
      .get('/api/data-management/integrity/check')
      .set('Cookie', authCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ issues: [], status: 'healthy' });
    expect(BulkOperationsManager.validateDataIntegrity).toHaveBeenCalled();
  });

  test('POST /api/error-logs accepts unauthenticated reports', async () => {
    const payload = {
      error: 'TestError',
      context: { currentPage: '/login' },
      timestamp: new Date().toISOString(),
    };

    const response = await request(app)
      .post('/api/error-logs')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', expect.any(Boolean));
  });

  test('GET /api/work-logs responds without 404', async () => {
    const response = await request(app)
      .get('/api/work-logs')
      .set('Cookie', authCookie);

    expect([200, 403]).toContain(response.status);
  });

  test('DELETE /api/work-logs/:id resolves auth middleware path', async () => {
    const response = await request(app)
      .delete('/api/work-logs/123')
      .set('Cookie', authCookie);

    expect([204, 403]).toContain(response.status);
  });

  test('POST /api/shoutouts/test route is registered', async () => {
    const response = await request(app)
      .post('/api/shoutouts/test')
      .set('Cookie', authCookie)
      .send({});

    expect([200, 403, 500]).toContain(response.status);
  });
});
