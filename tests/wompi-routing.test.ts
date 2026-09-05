import { describe, it, expect, vi } from 'vitest';
import { wompiProject, forwardNexantWompiEvent, NEXANT_WOMPI_EVENTS_URL } from '../src/lib/wompi-routing';

describe('single-project routing of authoritative transactions', () => {
  it('recognizes Nexant private proposals without activating a SaaS plan', () => {
    expect(wompiProject({ reference: `NX-IBAGUE-INICIAL-${'a'.repeat(24)}` })).toBe('nexant');
  });
  it('isolates TradingLab even when a link is present', () => {
    expect(wompiProject({ reference: `tl_${'a'.repeat(48)}`, payment_link_id: 'nx-link-1' })).toBe('tradinglab');
  });
  it('does not send malformed TradingLab references to Nexant', () => {
    expect(wompiProject({ reference: 'tl_invalid', payment_link_id: 'nx-link-1' })).toBeNull();
  });
  it.each([`sub_${'b'.repeat(16)}_abcdefghijklmno`, 'product_abcdefghijklmno'])('recognizes Nexant checkout %s', reference => {
    expect(wompiProject({ reference })).toBe('nexant');
  });
  it('allows Nexant to verify payment-link ownership', () => {
    expect(wompiProject({ reference: 'provider-reference', payment_link_id: 'link-123' })).toBe('nexant');
  });
  it.each(['unknown-order', 'https://attacker.example', 'product_short', 'sub_invalid'])('requires review for %s', reference => {
    expect(wompiProject({ reference })).toBeNull();
  });
  it('forwards only to the fixed HTTPS receiver without secrets or redirects', async () => {
    const send = vi.fn(async () => Response.json({ received: true }));
    await forwardNexantWompiEvent('{"event":"fixture"}', 'signed-fixture', send);
    expect(send).toHaveBeenCalledWith(NEXANT_WOMPI_EVENTS_URL, expect.objectContaining({ method: 'POST', body: '{"event":"fixture"}', redirect: 'error', cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-Event-Checksum': 'signed-fixture' } }));
  });
  it.each([202, 302, 401, 409, 500, 503])('does not acknowledge receiver HTTP %s', async status => {
    const send = vi.fn(async () => Response.json({ received: true }, { status }));
    await expect(forwardNexantWompiEvent('{}', 'fixture', send)).rejects.toThrow();
  });
  it('does not treat a homepage or unrelated JSON as acknowledgement', async () => {
    await expect(forwardNexantWompiEvent('{}', 'fixture', async () => new Response('<html>ok</html>'))).rejects.toThrow();
    await expect(forwardNexantWompiEvent('{}', 'fixture', async () => Response.json({ ok: true }))).rejects.toThrow();
  });
  it('keeps timeout failures retryable', async () => {
    await expect(forwardNexantWompiEvent('{}', 'fixture', async () => { throw new Error('timeout'); })).rejects.toThrow('timeout');
  });
});
