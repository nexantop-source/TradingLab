import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const usage = vi.hoisted(() => ({ simulations: 0, monthlyAI: 0 }));
vi.mock('../src/lib/db', () => ({ db: {
  simulation: { count: async () => usage.simulations },
  aIUsage: { findUnique: async () => ({ calls: 0 }), aggregate: async () => ({ _sum: { calls: usage.monthlyAI } }) },
  portfolio: { count: async () => 1 }, alert: { count: async () => 0 }, demoAccount: { findFirst: async () => null },
} }));
vi.mock('../src/lib/auth', () => ({ ForbiddenError: class extends Error {} }));
import { checkAILimit, checkSimulationLimit } from '../src/lib/entitlements';

describe('Colombia launch usage boundaries', () => {
  beforeEach(() => { usage.simulations = 0; usage.monthlyAI = 0; });
  it('applies the free monthly AI cap even with no calls today, and offers Plus', async () => {
    usage.monthlyAI = 2;
    expect((await checkAILimit('fixture', 'FREE')).allowed).toBe(true);
    usage.monthlyAI = 3;
    expect(await checkAILimit('fixture', 'FREE')).toMatchObject({ allowed: false, limit: 3, upgradeTo: 'STANDARD' });
  });
  it('offers Pro when Plus reaches its AI cap, and no upgrade above Pro', async () => {
    usage.monthlyAI = 60;
    expect(await checkAILimit('fixture', 'STANDARD')).toMatchObject({ allowed: false, upgradeTo: 'PREMIUM' });
    usage.monthlyAI = 300;
    expect(await checkAILimit('fixture', 'PREMIUM')).toMatchObject({ allowed: false, upgradeTo: null });
  });
  it('enforces daily practice limits and suggests the next plan', async () => {
    usage.simulations = 2;
    expect(await checkSimulationLimit('fixture', 'FREE')).toMatchObject({ allowed: false, upgradeTo: 'STANDARD' });
    expect((await checkSimulationLimit('fixture', 'STANDARD')).allowed).toBe(true);
    usage.simulations = 20;
    expect(await checkSimulationLimit('fixture', 'STANDARD')).toMatchObject({ allowed: false, upgradeTo: 'PREMIUM' });
    expect((await checkSimulationLimit('fixture', 'PREMIUM')).allowed).toBe(true);
  });
});
