import type { NextConfig } from 'next';

/**
 * Cabeceras de seguridad. La CSP se mantiene estricta: sin `unsafe-eval`,
 * y los únicos orígenes externos permitidos son los de fuentes de Google y
 * el endpoint de OpenAI (usado exclusivamente desde el servidor).
 *
 * `unsafe-inline` en script-src es necesario para el runtime de Next.js en
 * modo desarrollo. En producción se sustituye por nonce (ver docs/SECURITY.md).
 */
const isDev = process.env.NODE_ENV !== 'production';
// Esta variable es de build-time. Si está apagada, no se concede ningún origen
// de Google. La allowlist es solo una puerta de staging: AdSense exige CSP
// estricta con nonce para producción (ver docs/ADS.md).
const googleAdsEnabled = process.env.NEXT_PUBLIC_GOOGLE_ADS_ENABLED === 'true';

const googleScriptSources = googleAdsEnabled
  ? ' https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com'
  : '';
const googleConnectSources = googleAdsEnabled
  ? ' https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google'
  : '';
const googleFrameSources = googleAdsEnabled
  ? 'https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com'
  : "'none'";

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${googleScriptSources}`,
  `style-src 'self' 'unsafe-inline'`,
  `font-src 'self' data:`,
  `img-src 'self' data: blob: https:`,
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}${googleConnectSources}`,
  `frame-src ${googleFrameSources}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
