import { describe, expect, it } from 'vitest';
import { marketSnapshotLabel } from '../src/lib/market-freshness';

describe('market snapshot disclosure', () => {
  const sample = { synthetic: false, timestamp: 100_000, freshness: 'REALTIME' as const, marketStatus: 'OPEN' as const };
  it('ages an initially recent snapshot instead of promising a live stream', () => {
    expect(marketSnapshotLabel(sample, 110_000)).toBe('Muestra reciente · al consultar');
    expect(marketSnapshotLabel(sample, 191_000)).toBe('Dato desactualizado');
  });
  it('preserves provider-reported delay and stale data even with a recent timestamp', () => {
    expect(marketSnapshotLabel({ ...sample, freshness: 'DELAYED' }, 101_000)).toBe('Dato diferido');
    expect(marketSnapshotLabel({ ...sample, freshness: 'STALE' }, 101_000)).toBe('Dato desactualizado');
  });
  it('separates closed-market references and synthetic series', () => {
    expect(marketSnapshotLabel({ ...sample, marketStatus: 'CLOSED' }, 900_000)).toBe('Mercado cerrado · última referencia');
    expect(marketSnapshotLabel({ ...sample, synthetic: true })).toBe('Serie simulada');
  });
});
