import express from 'express';
import request from 'supertest';
import { createPageProxyHandler } from '../routes/page-proxy';

describe('page proxy origin allowlist', () => {
  const fetchMock = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => '<html><head></head><body>ok</body></html>',
  })) as unknown as jest.MockedFunction<typeof fetch>;

  const app = express();
  app.get('/api/proxy/page', createPageProxyHandler(fetchMock));

  beforeEach(() => fetchMock.mockClear());

  it('proxies a page on an allowlisted origin', async () => {
    const url = 'https://the-sandwich-project.github.io/sandwichinventory/toolkit.html';
    const res = await request(app).get('/api/proxy/page').query({ url });
    expect(res.status).toBe(200);
    expect(res.text).toContain(
      '<base href="https://the-sandwich-project.github.io/sandwichinventory/" />'
    );
    expect(fetchMock).toHaveBeenCalledWith(url);
  });

  it('rejects a malformed url without fetching', async () => {
    const res = await request(app).get('/api/proxy/page').query({ url: 'not a url' });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'https://the-sandwich-project.github.io.attacker.example/',
    'https://the-sandwich-project.github.io@attacker.example/',
    'http://the-sandwich-project.github.io/',
  ])('rejects lookalike or non-https origin %s without fetching', async (url) => {
    const res = await request(app).get('/api/proxy/page').query({ url });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
