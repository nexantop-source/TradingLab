import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe('runtime market source fails closed', () => {
  it('defaults to Yahoo when no provider is configured', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', '');
    const { marketData } = await import('../src/packages/market-data/registry');
    expect(marketData().id).toBe('yahoo-chart-v1');
  });
  it('rejects unknown providers instead of silently generating prices', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', 'missing-provider');
    const { marketData } = await import('../src/packages/market-data/registry');
    expect(() => marketData()).toThrow('fuente real');
  });
  it('rejects a synthetic provider outside the test environment', async () => {
    vi.stubEnv('MARKET_DATA_PROVIDER', 'synthetic');
    vi.stubEnv('NODE_ENV', 'production');
    const { marketData } = await import('../src/packages/market-data/registry');
    expect(() => marketData()).toThrow('fuente real');
  });
});
