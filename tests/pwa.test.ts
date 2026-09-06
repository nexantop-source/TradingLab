import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const worker = readFileSync('public/sw.js', 'utf8');
const origin = 'https://tradinglab.test';

function harness() {
  const listeners: Record<string, (event: any) => void> = {};
  const cached = new Response('PUBLIC OFFLINE PAGE');
  const cache = { add: vi.fn(async (_request: Request) => {}), match: vi.fn(async (_url: string) => cached), put: vi.fn() };
  const caches = { open: vi.fn(async (_key: string) => cache), keys: vi.fn(async () => ['another-app', 'tradinglab-public-v0', 'tradinglab-public-v1', 'tradinglab-public-v2']), delete: vi.fn(async (_key: string) => true) };
  const fetch = vi.fn(async (_request: unknown) => new Response('ONLINE ACCOUNT HTML'));
  const self = { location: { origin }, addEventListener: (name: string, callback: any) => { listeners[name] = callback; }, clients: { claim: vi.fn(async () => {}) }, skipWaiting: vi.fn() };
  class BrowserRequest extends Request { constructor(url: string, init?: RequestInit) { super(new URL(url, origin), init); } }
  runInNewContext(worker, { self, caches, fetch, Request: BrowserRequest, Response, URL });
  return { listeners, cached, cache, caches, fetch, self };
}

describe('private-by-default PWA', () => {
  it('installs only a public offline document, without cookies', async () => {
    const h = harness(); let work: Promise<unknown> | undefined;
    h.listeners.install({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
    expect(h.cache.add).toHaveBeenCalledTimes(1);
    const request = h.cache.add.mock.calls[0]?.[0] as unknown as Request;
    expect(request.url).toBe(`${origin}/offline.html`);
    expect(request.credentials).toBe('omit');
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
  });
  it.each([
    { method: 'POST', mode: 'navigate', url: `${origin}/api/billing/checkout` },
    { method: 'GET', mode: 'navigate', url: `${origin}/api/me` },
    { method: 'GET', mode: 'cors', url: `${origin}/panel?_rsc=123` },
    { method: 'GET', mode: 'navigate', url: 'https://checkout.wompi.co/' },
  ])('does not intercept $method $url', request => {
    const h = harness(); const respondWith = vi.fn();
    h.listeners.fetch({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(h.caches.open).not.toHaveBeenCalled();
  });
  it('uses the network for account navigation and never caches the response', async () => {
    const h = harness(); let response: Promise<Response> | undefined;
    h.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `${origin}/perfil` }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response)?.text()).toBe('ONLINE ACCOUNT HTML');
    expect(h.cache.put).not.toHaveBeenCalled();
    expect(h.caches.open).not.toHaveBeenCalled();
  });
  it('shows only the public fallback when navigation fails', async () => {
    const h = harness(); h.fetch.mockRejectedValueOnce(new Error('Offline'));
    let response: Promise<Response> | undefined;
    h.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `${origin}/perfil` }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await response).toBe(h.cached);
    expect(h.cache.match).toHaveBeenCalledWith('/offline.html');
    expect(h.cache.put).not.toHaveBeenCalled();
  });
  it('only deletes obsolete TradingLab public caches', async () => {
    const h = harness(); let work: Promise<unknown> | undefined;
    h.listeners.activate({ waitUntil: (promise: Promise<unknown>) => { work = promise; } });
    await work;
    expect(h.caches.delete.mock.calls).toEqual([['tradinglab-public-v0'], ['tradinglab-public-v1']]);
  });
  it('activates an update only with the explicit update message', () => {
    const h = harness(); h.listeners.message({ data: { type: 'OTHER' } });
    expect(h.self.skipWaiting).not.toHaveBeenCalled();
    h.listeners.message({ data: { type: 'ACTIVATE_UPDATE' } });
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1);
  });
  it('has installable PNGs and a stable dedicated entry', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(manifest.start_url).toBe('/app');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: '/app-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' }),
      expect.objectContaining({ src: '/app-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' }),
    ]));
  });
});
