// Local-only TLS wrapper for WebKit's production Secure cookie checks.
// Generated test certificate stays in a new OS temp folder; never trust it in
// the OS or use it for a public server. No personal browser profiles are used.
const { mkdtempSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const folder = mkdtempSync(join(tmpdir(), 'tradinglab-pwa-tls-'));
const key = join(folder, 'key.pem');
const cert = join(folder, 'cert.pem');
const openssl = process.env.PWA_QA_OPENSSL || 'openssl';
execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost'], { stdio: 'ignore' });
https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  const upstream = http.request({ hostname: '127.0.0.1', port: 3010, path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https' } }, response => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Local QA server unavailable'); });
  req.pipe(upstream);
}).listen(3443, '127.0.0.1', () => console.log('Local PWA TLS: https://127.0.0.1:3443 → http://127.0.0.1:3010'));
