/** Routing input MUST come from Wompi's transaction API, never the webhook body. */
export function wompiProject(transaction: { reference: string; payment_link_id?: unknown }): 'tradinglab' | 'nexant' | null {
  if (/^tl_[a-f0-9]{48}$/.test(transaction.reference)) return 'tradinglab';
  // A malformed TradingLab reference cannot fall through to another project.
  if (transaction.reference.startsWith('tl_')) return null;
  if (/^NX-IBAGUE-INICIAL-[a-f0-9]{24}$/.test(transaction.reference)) return 'nexant';
  if (/^sub_[a-f0-9]{16}_[A-Za-z0-9]{10,40}$/.test(transaction.reference) || /^product_[A-Za-z0-9]{10,40}$/.test(transaction.reference)) return 'nexant';
  // Nexant's receiver must look up ownership of this link in its own database.
  if (typeof transaction.payment_link_id === 'string' && /^[A-Za-z0-9_-]{4,80}$/.test(transaction.payment_link_id)) return 'nexant';
  return null;
}

export const NEXANT_WOMPI_EVENTS_URL = 'https://nexantcorp.com/api/billing/webhooks/wompi';

/** Fixed destination, no credentials, no redirects and no customer-selected URL. */
export async function forwardNexantWompiEvent(raw: string, checksum: string, send: typeof fetch = fetch): Promise<void> {
  const response = await send(NEXANT_WOMPI_EVENTS_URL, {
    method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'X-Event-Checksum': checksum },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  // A redirect, generic landing page or 202 is not proof of durable processing.
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('application/json')) throw new Error('NEXANT_EVENT_NOT_ACKNOWLEDGED');
  const text = await response.text();
  if (text.length > 4096) throw new Error('NEXANT_EVENT_NOT_ACKNOWLEDGED');
  const result = JSON.parse(text);
  if (result?.received !== true) throw new Error('NEXANT_EVENT_NOT_ACKNOWLEDGED');
}
