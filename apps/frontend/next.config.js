/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Standalone output so Dockerfile.frontend can copy .next/standalone
  // (self-contained server bundle with no node_modules in the image).
  output: 'standalone',

  // Security headers for direct frontend deploys (no Caddy edge). When served
  // behind Caddy (docker-compose.tls.yml) these are redundant but harmless -
  // Caddy's edge headers win. CSP intentionally lives at the edge (Caddyfile)
  // because Next.js static chunks need 'unsafe-inline'/'unsafe-eval' and a
  // strict per-route CSP would break them.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
    ];
  },
};

const isDev = process.env.NODE_ENV === 'development';

// @ducanh2912/next-pwa is the actively-maintained fork of the abandoned
// next-pwa (no releases since 2022). Same Workbox-backed API — the fork
// handles Next 14 App Router + Turbopack, which the original never did.
// CJS interop: the package's default export (withPWAInit) lives at `.default`.
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  // Never register in dev — a stale service worker caching hot-reloaded
  // chunks is a classic Next.js dev footgun. Production only.
  register: !isDev,
  skipWaiting: true,
  disable: isDev,
  runtimeCaching: [
    // Pages & navigations — NetworkFirst: fresh when online, cached offline.
    // NOTE: these are app-shell navigations; patient data itself is never
    // written to the HTTP cache (it lives in the encrypted IndexedDB layer).
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin &&
        (url.pathname === '/' ||
          url.pathname.startsWith('/dashboard') ||
          url.pathname.startsWith('/intake')),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'jeevandata-pages',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // Static assets — stale-while-revalidate for speed
    {
      urlPattern: ({ url }) =>
        url.origin === self.location.origin && url.pathname.startsWith('/_next/'),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'jeevandata-static',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
        },
      },
    },
  ],
});

module.exports = withPWA(nextConfig);
