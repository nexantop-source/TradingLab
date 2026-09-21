import { describe, expect, it } from 'vitest';
import { SYMBOLS, getSymbol } from '../src/packages/market-data/symbols';
import { marketStatusFor, lastOpenTimestamp, nextOpenTimestamp, observedMarketStatus } from '../src/packages/market-data/market-hours';
import { quoteIsTradable } from '../src/packages/market-data/tradability';
import type { DataProvenance } from '../src/packages/types';
const equity = getSymbol('AAPL')!.session;
// Independently transcribed published NYSE calendar, 2026–2028.
const holidays = ['2026-01-01','2026-01-19','2026-02-16','2026-04-03','2026-05-25','2026-06-19','2026-07-03','2026-09-07','2026-11-26','2026-12-25',
 '2027-01-01','2027-01-18','2027-02-15','2027-03-26','2027-05-31','2027-06-18','2027-07-05','2027-09-06','2027-11-25','2027-12-24',
 '2028-01-17','2028-02-21','2028-04-14','2028-05-29','2028-06-19','2028-07-04','2028-09-04','2028-11-23','2028-12-25'];
describe('US sessions match the published exchange calendar', () => {
  it.each(holidays)('closes %s even when a provider reports a recent trade', date => {
    const at=Date.parse(date+'T16:00:00Z');
    expect(marketStatusFor(equity,at)).toBe('HOLIDAY');
    expect(observedMarketStatus(equity,at,at)).toBe('HOLIDAY');
  });
  it.each(['2026-11-27','2026-12-24','2027-11-26','2028-07-03','2028-11-24'])('honors the early close on %s', date => {
    const offset=date.includes('-07-')?'-04:00':'-05:00';
    expect(marketStatusFor(equity,Date.parse(date+'T12:59:59'+offset))).toBe('OPEN');
    const close=Date.parse(date+'T13:00:00'+offset);
    expect(marketStatusFor(equity,close)).toBe('CLOSED');
    expect(lastOpenTimestamp(equity,close+60000)).toBe(close-1);
  });
  it('uses New York DST and preserves Dec 31 before Saturday New Year', () => {
    expect(marketStatusFor(equity,Date.parse('2026-01-06T14:00Z'))).toBe('PRE_OPEN');
    expect(marketStatusFor(equity,Date.parse('2026-01-06T14:30Z'))).toBe('OPEN');
    expect(marketStatusFor(equity,Date.parse('2026-07-06T13:30Z'))).toBe('OPEN');
    expect(marketStatusFor(equity,Date.parse('2027-12-31T19:00Z'))).toBe('OPEN');
  });
  it('does not confuse US bank holidays with exchange closures', () => {
    expect(marketStatusFor(equity,Date.parse('2026-10-12T15:00Z'))).toBe('OPEN');
    expect(marketStatusFor(equity,Date.parse('2026-11-11T15:00Z'))).toBe('OPEN');
  });
  it('skips the holiday weekend and returns the exact next opening', () => {
    const at=Date.parse('2026-07-03T16:01:23Z');
    expect(lastOpenTimestamp(equity,at)).toBe(Date.parse('2026-07-02T20:00Z')-1);
    expect(nextOpenTimestamp(equity,at)).toBe(Date.parse('2026-07-06T13:30Z'));
  });
  it('closes every non-crypto catalogue instrument on Saturday', () => {
    for (const asset of SYMBOLS) {
      expect(marketStatusFor(asset.session,Date.parse('2026-09-19T16:00Z')),asset.symbol).toBe(asset.session.alwaysOpen?'OPEN':'CLOSED');
    }
  });
  it('keeps US holidays scoped to cash markets; FX reopens Sunday with DST', () => {
    const forex=getSymbol('EURUSD')!.session;
    expect(marketStatusFor(forex,Date.parse('2026-09-07T15:00Z'))).toBe('OPEN');
    expect(marketStatusFor(forex,Date.parse('2026-09-20T21:00Z'))).toBe('OPEN');
    expect(marketStatusFor(forex,Date.parse('2026-01-04T21:00Z'))).toBe('CLOSED');
    expect(marketStatusFor(forex,Date.parse('2026-01-04T22:00Z'))).toBe('OPEN');
    for(const a of SYMBOLS.filter(a=>a.session.alwaysOpen)) expect(marketStatusFor(a.session,Date.parse('2026-12-25T16:00Z'))).toBe('OPEN');
  });
  it('rejects a cached OPEN quote after the calendar closes', () => {
    const at=Date.parse('2026-07-03T16:00Z');
    const provenance={marketStatus:'OPEN',freshness:'REALTIME',synthetic:false,sourceTimestamp:at} as DataProvenance;
    expect(quoteIsTradable({symbol:'AAPL',provenance},{declaredDelaySeconds:900},at)).toBe(false);
  });
});
