'use client';

import { useEffect, useRef, useState } from 'react';
import type { DataProvenance, Quote } from '@tl/types';
import { mergeMarketTicks, PULSE_STALE_MS, type MarketPulse, type MarketTick } from './marketPulse';

export type PulseStatus = 'connecting' | 'live' | 'stale' | 'offline' | 'paused';
export type InitialPulseQuote = Pick<Quote, 'price' | 'bid' | 'ask' | 'changePercent' | 'dayHigh' | 'dayLow'> & Partial<Quote>;
interface PulseState {
  symbol: string;
  ticks: MarketTick[];
  quote: Quote;
  provenance: DataProvenance;
  status: PulseStatus;
  stale: boolean;
  ageSeconds: number;
  error: string | null;
}

function initialState(symbol: string, quote: InitialPulseQuote, provenance: DataProvenance): PulseState {
  return {
    symbol, ticks: [], provenance, status: 'connecting', stale: true, ageSeconds: 0, error: null,
    quote: { symbol, volume: 0, change: 0, previousClose: quote.price, ...quote, provenance },
  };
}

function validPulse(data: MarketPulse, symbol: string): boolean {
  return data?.mode === 'DEMO' && data.symbol === symbol && Number.isSafeInteger(data.serverTime)
    && Array.isArray(data.ticks) && data.ticks.length <= 121
    && data.quote?.symbol === symbol && Number.isFinite(data.quote.price) && data.quote.price > 0
    && Number.isFinite(data.quote.bid) && Number.isFinite(data.quote.ask)
    && typeof data.provenance?.synthetic === 'boolean';
}

/** A single abortable request at a time; the UI never invents market movement. */
export function useMarketPulse(symbol: string, initialQuote: InitialPulseQuote, initialProvenance: DataProvenance): PulseState {
  const initial = useRef({ quote: initialQuote, provenance: initialProvenance });
  initial.current = { quote: initialQuote, provenance: initialProvenance };
  const [state, setState] = useState(() => initialState(symbol, initialQuote, initialProvenance));

  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let cursor: number | undefined;
    let lastReceived = 0;
    let failures = 0;
    let blocked = false;
    setState(initialState(symbol, initial.current.quote, initial.current.provenance));

    const inactive = (): PulseStatus | null => !navigator.onLine ? 'offline' : document.hidden ? 'paused' : null;
    const updateAge = () => {
      if (!lastReceived || inactive()) return;
      const elapsed = performance.now() - lastReceived;
      setState(current => ({ ...current, ageSeconds: Math.floor(elapsed / 1000),
        stale: elapsed > PULSE_STALE_MS || current.status !== 'live',
        status: elapsed > PULSE_STALE_MS && current.status === 'live' ? 'stale' : current.status,
      }));
    };

    async function poll() {
      if (disposed || inactive() || blocked) return;
      const run = generation;
      const request = new AbortController();
      controller = request;
      const started = performance.now();
      let delay = 1000;
      const timeout = setTimeout(() => request.abort(), 8000);
      try {
        const params = new URLSearchParams({ symbol });
        if (cursor != null) params.set('since', String(cursor));
        const response = await fetch(`/api/market/pulse?${params}`, {
          signal: request.signal, cache: 'no-store', credentials: 'same-origin',
        });
        if (disposed || run !== generation) return;
        if (response.status === 429) {
          const retry = Number(response.headers.get('Retry-After'));
          delay = Math.min(120_000, Math.max(1000, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 10_000));
          throw new Error('La actualización está en pausa. Reintentaremos en unos segundos.');
        }
        const result = await response.json();
        if (!response.ok || !result.ok) {
          blocked = response.status === 401 || response.status === 403;
          throw new Error(result?.error?.message || 'No pudimos actualizar el precio.');
        }
        const data = result.data as MarketPulse;
        if (!validPulse(data, symbol)) throw new Error('No pudimos validar la serie recibida.');
        if (disposed || run !== generation) return;
        cursor = data.serverTime;
        lastReceived = performance.now();
        failures = 0;
        delay = Math.max(100, 1000 - (lastReceived - started));
        setState(current => ({
          symbol, ticks: mergeMarketTicks(current.symbol === symbol ? current.ticks : [], data.ticks, data.serverTime),
          quote: data.quote, provenance: data.provenance, status: 'live', stale: false, ageSeconds: 0, error: null,
        }));
      } catch (error) {
        if (disposed || run !== generation) return;
        failures++;
        delay = Math.max(delay, Math.min(15_000, 1000 * 2 ** Math.min(failures, 4)));
        setState(current => ({ ...current, status: inactive() ?? 'stale', stale: true,
          error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'La conexión tardó demasiado. Reintentando…',
        }));
      } finally {
        clearTimeout(timeout);
        if (controller === request) controller = undefined;
        if (!disposed && run === generation && !inactive() && !blocked) timer = setTimeout(poll, delay);
      }
    }

    function resume() {
      generation++;
      clearTimeout(timer);
      controller?.abort();
      cursor = undefined;
      blocked = false;
      failures = 0;
      const status = inactive();
      setState(current => ({ ...current, status: status ?? 'connecting', stale: true,
        error: status === 'offline' ? 'Sin conexión. El gráfico conserva el último precio recibido.' : null,
      }));
      if (!status) void poll();
    }

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', resume);
    const ageTimer = setInterval(updateAge, 1000);
    resume();
    return () => {
      disposed = true;
      generation++;
      clearTimeout(timer);
      clearInterval(ageTimer);
      controller?.abort();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', resume);
    };
  }, [symbol]);

  // A route can change symbol before its effect runs: never show the prior asset.
  return state.symbol === symbol ? state : initialState(symbol, initialQuote, initialProvenance);
}
