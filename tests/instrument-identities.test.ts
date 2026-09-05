import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SYMBOLS } from '@tl/market-data';
import identities from '../src/components/investment/instrument-identities.json';

describe('instrument identities', () => {
  const inventory = identities as Record<string, { label: string; src: string; secondary?: string; kind?: string }>;
  it('covers every tradable instrument without a generic class icon', () => {
    expect(Object.keys(inventory).sort()).toEqual(SYMBOLS.map(s => s.symbol).sort());
    for (const instrument of SYMBOLS) {
      const identity = inventory[instrument.symbol];
      expect(identity.label.length).toBeGreaterThan(1);
      if (instrument.assetClass === 'FOREX') expect(identity.secondary).toBeTruthy();
      if (instrument.assetClass === 'ETF') expect(identity.kind).toBe('fund');
    }
  });
  it('ships safe local SVGs for all primary and counter-currency images', () => {
    const paths = new Set(Object.values(inventory).flatMap(i => [i.src, i.secondary].filter(Boolean)));
    for (const path of paths) {
      expect(path).toMatch(/^\/assets\/instruments\/[a-z0-9-]+\.svg$/);
      const svg = readFileSync(resolve('public', path!.slice(1)), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i);
    }
  });
  it('distinguishes Bitcoin, Apple and the two legs of EUR/USD', () => {
    expect(inventory.BTCUSD.src).toContain('/btc.svg');
    expect(inventory.AAPL.src).toContain('/apple.svg');
    expect(inventory.EURUSD.src).toContain('/flag-eu.svg');
    expect(inventory.EURUSD.secondary).toContain('/flag-us.svg');
  });
});
