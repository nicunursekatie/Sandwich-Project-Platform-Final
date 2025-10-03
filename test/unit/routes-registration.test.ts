import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

describe('Server route registration', () => {
  let routesContent: string;

  beforeAll(async () => {
    const routesPath = resolve(__dirname, '../../server/routes/index.ts');
    routesContent = await readFile(routesPath, 'utf8');
  });

  test('registers /api/data-management router', () => {
    expect(routesContent).toContain("router.use(\n    '/api/data-management'");
  });

  test('registers /api/error-logs router', () => {
    expect(routesContent).toContain("router.use(\n    '/api/error-logs'");
  });

  test('registers /api/work-logs router', () => {
    expect(routesContent).toContain("router.use(\n    '/api/work-logs'");
  });

  test('registers /api/shoutouts router', () => {
    expect(routesContent).toContain("router.use(\n    '/api/shoutouts'");
  });
});
