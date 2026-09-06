/** Billing CSRF boundary. Proxy Host/X-Forwarded-* headers are not trust anchors.
 * Firebase terminates HTTPS before Next, so nextUrl may name an internal HTTP
 * listener. Production compares against our explicitly configured public URL.
 */
export function isSameOriginRequest(req: { headers: Headers; nextUrl: URL }): boolean {
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin') return false;

  const production = process.env.NODE_ENV === 'production';
  let target: string;
  try {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (production && !configured) return false;
    const url = new URL(production ? configured! : req.nextUrl.origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return false;
    if (production && url.protocol !== 'https:') return false;
    target = url.origin;
  } catch { return false; }

  const origin = req.headers.get('origin');
  // An explicit null/malformed/foreign Origin must never fall back to Referer.
  if (origin !== null) return origin === target;
  const referer = req.headers.get('referer');
  if (referer) {
    try { return new URL(referer).origin === target; } catch { return false; }
  }
  // Some installed clients omit Origin; Fetch Metadata is browser-controlled.
  // With neither signal present this cookie-authenticated endpoint fails closed.
  return fetchSite === 'same-origin';
}
