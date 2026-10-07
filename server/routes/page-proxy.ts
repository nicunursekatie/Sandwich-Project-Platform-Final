import type { Request, Response } from 'express';

// Proxy for GitHub Pages content (bypasses X-Frame-Options restrictions)
export const ALLOWED_PROXY_ORIGINS = [
  'https://the-sandwich-project.github.io',
  'https://receipt-gen--katielong2316.replit.app',
  'https://bread-and-butter-donors.lovable.app',
  'https://tsp-host-handbook-ylfb92u.gamma.site',
];

export function createPageProxyHandler(fetchImpl: typeof fetch = fetch) {
  return async (req: Request, res: Response) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ message: 'Missing url parameter' });
      }
      // Only allow proxying from trusted origins (compare parsed origins, not
      // string prefixes, so lookalikes like https://allowed.io.evil.example fail)
      let requestedOrigin: string;
      try {
        requestedOrigin = new URL(url).origin;
      } catch {
        return res.status(400).json({ message: 'Invalid url parameter' });
      }
      if (!ALLOWED_PROXY_ORIGINS.includes(requestedOrigin)) {
        return res.status(403).json({ message: 'URL not in allowlist' });
      }
      const response = await fetchImpl(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: `Upstream returned ${response.status}` });
      }
      const html = await response.text();
      // Rewrite relative asset URLs to absolute so CSS/JS/images load correctly
      const baseUrl = new URL(url);
      const base = `${baseUrl.protocol}//${baseUrl.host}${baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1)}`;
      const rewritten = html.replace(
        /(<head[^>]*>)/i,
        `$1<base href="${base}" />`
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.send(rewritten);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Proxy fetch failed' });
    }
  };
}
