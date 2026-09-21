import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DataProvenanceBadge } from '../src/packages/ui/DataProvenanceBadge';
import { marketSnapshotLabel } from '../src/lib/market-freshness';
import { getSymbol } from '../src/packages/market-data/symbols';
import { marketStatusFor, lastOpenTimestamp } from '../src/packages/market-data/market-hours';
import { quoteIsTradable } from '../src/packages/market-data/tradability';
import { YahooMarketDataProvider, resetYahooCache } from '../src/packages/market-data/yahoo-provider';
import type { DataProvenance } from '../src/packages/types';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();resetYahooCache();});
describe('closed session takes precedence over a delayed quote everywhere',()=>{
  it.each(['CLOSED','HOLIDAY','PRE_OPEN'] as const)('labels %s as closed even if freshness is delayed',marketStatus=>{
    const p={marketStatus,freshness:'DELAYED',latencyMs:600000,synthetic:false} as DataProvenance;
    const html=renderToStaticMarkup(React.createElement(DataProvenanceBadge,{provenance:p}));
    expect(html).toContain('Mercado cerrado');expect(html).not.toContain('Retrasado');expect(html).toContain('Última referencia');
    expect(marketSnapshotLabel({...p,timestamp:1})).toBe('Mercado cerrado · última referencia');
  });
  it('retains the delay warning for a genuinely open session',()=>{
    const p={marketStatus:'OPEN',freshness:'DELAYED',latencyMs:600000} as DataProvenance;
    expect(renderToStaticMarkup(React.createElement(DataProvenanceBadge,{provenance:p}))).toContain('Retrasado');
  });
  const cop=getSymbol('USDCOP')!.session;
  it.each(['2026-09-20T23:00Z','2026-09-21T12:59Z','2026-09-21T18:00Z'])('blocks USD/COP outside local spot hours %s',date=>{
    const at=Date.parse(date);
    expect(marketStatusFor(cop,at)).not.toBe('OPEN');
    expect(quoteIsTradable({symbol:'USDCOP',provenance:{marketStatus:'OPEN',freshness:'REALTIME',synthetic:false,sourceTimestamp:at} as DataProvenance},{declaredDelaySeconds:900},at)).toBe(false);
  });
  it('opens local spot at 08:00 and observes Colombian holidays',()=>{
    expect(marketStatusFor(cop,Date.parse('2026-09-21T13:00Z'))).toBe('OPEN');
    for(const date of ['2026-01-12','2026-03-23','2026-04-02','2026-04-03','2026-05-18','2026-06-08','2026-06-15','2026-07-20','2026-08-07','2026-10-12','2026-11-16','2026-12-08']) expect(marketStatusFor(cop,Date.parse(date+'T15:00Z')),date).toBe('HOLIDAY');
    expect(lastOpenTimestamp(cop,Date.parse('2026-07-20T15:00Z'))).toBe(Date.parse('2026-07-17T18:00Z')-1);
  });
  it('marks a recent Yahoo USD/COP quote as market closed on Sunday',async()=>{
    vi.useFakeTimers();const now=Date.parse('2026-09-20T23:00Z');vi.setSystemTime(now);
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json({chart:{result:[{meta:{regularMarketPrice:4000,regularMarketTime:now/1000-300}}]}})));
    const q=await new YahooMarketDataProvider().getQuote('USDCOP');
    expect(q.provenance.marketStatus).toBe('CLOSED');expect(q.provenance.freshness).toBe('MARKET_CLOSED');expect(q.price).toBe(4000);
  });
});
