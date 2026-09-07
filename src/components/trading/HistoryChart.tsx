'use client';

// Lightweight Charts™ — Copyright (c) TradingView, Inc. — Apache-2.0.
// La atribución que exige la licencia vive en /legal/creditos-de-software.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  AreaSeries,
  CandlestickSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, DataProvenance } from '@tl/types';
import { apiFetch } from '@/lib/client-api';
import type { ChartLevel } from './SimpleLiveChart';
import { historyRange, HISTORY_RANGES } from './historyRanges';

/**
 * Historia real de un instrumento.
 *
 * Es lo que faltaba en la terminal: hasta ahora el gráfico solo sabía enseñar
 * la ventana del pulso -uno o dos minutos-, que no dice nada sobre el activo.
 * Aquí se pide la serie de verdad al servidor y se puede recorrer desde el día
 * de hoy hasta el primer día negociado.
 *
 * Dos decisiones que importan:
 *
 *   · **El rango vive en el componente, no en el gráfico.** Cambiar de "1 mes"
 *     a "todo" no es hacer zoom sobre los mismos datos: es pedir otra serie,
 *     con otra granularidad. Hacerlo con zoom obligaría a traer medio millón de
 *     velas de un minuto para que la persona mire cuarenta años.
 *   · **Nunca se muestra la serie anterior bajo un rótulo nuevo.** Mientras la
 *     petición está en vuelo el gráfico conserva lo que había, pero el resumen
 *     de variación se apaga: un porcentaje de un año junto al rótulo "1 día"
 *     sería mentira durante el segundo que tarda la respuesta.
 */

interface HistoryResponse {
  candles: Candle[];
  provenance: DataProvenance;
}

const UP = '#34d39e';
const DOWN = '#f45d75';

export function HistoryChart({
  symbol,
  precision,
  rangeId,
  type,
  levels,
  onSummary,
}: {
  symbol: string;
  precision: number;
  rangeId: string;
  type: 'line' | 'area' | 'candles';
  levels: ChartLevel[];
  /** Variación del periodo, para que la cabecera la pueda enseñar. */
  onSummary?: (summary: { changePercent: number; from: number; to: number; points: number } | null) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Line' | 'Area' | 'Candlestick'> | null>(null);
  const levelLines = useRef<ReturnType<ISeriesApi<'Line'>['createPriceLine']>[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const range = historyRange(rangeId);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState('loading');
    setError(null);
    onSummary?.(null);
    void (async () => {
      try {
        const data = await apiFetch<HistoryResponse>(
          `/api/market/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${range.timeframe}&limit=${range.limit}`,
          { signal: controller.signal, cache: 'no-store' },
        );
        if (cancelled) return;
        setCandles(data.candles);
        setSource(data.provenance?.providerLabel ?? null);
        setState('ready');
      } catch (failure) {
        if (cancelled || controller.signal.aborted) return;
        setState('error');
        setError(
          failure instanceof Error
            ? failure.message
            : 'No pudimos traer el historial de este instrumento.',
        );
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // `onSummary` es una función del padre y cambiar de identidad no debe
    // relanzar la petición; el rango y el símbolo son los que mandan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, range.timeframe, range.limit]);

  const summary = useMemo(() => {
    if (candles.length < 2) return null;
    const first = candles[0];
    const last = candles[candles.length - 1];
    if (!(first.o > 0)) return null;
    return {
      changePercent: (last.c / first.o - 1) * 100,
      from: first.t,
      to: last.t,
      points: candles.length,
    };
  }, [candles]);

  useEffect(() => {
    if (state === 'ready') onSummary?.(summary);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, state]);

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const created = createChart(element, {
      autoSize: true,
      height: matchMedia('(min-width:1024px)').matches ? 360 : 230,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: getComputedStyle(element).color,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: '#8395a21c' } },
      rightPriceScale: { borderVisible: false },
      timeScale: { timeVisible: false, borderVisible: false, rightOffset: 4 },
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true },
      crosshair: { mode: 0 },
      localization: {
        priceFormatter: (value: number) =>
          value.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision }),
      },
    });
    chart.current = created;
    series.current =
      type === 'candles'
        ? created.addSeries(CandlestickSeries, {
            upColor: UP,
            downColor: DOWN,
            wickUpColor: UP,
            wickDownColor: DOWN,
            borderVisible: false,
          })
        : type === 'area'
          ? created.addSeries(AreaSeries, { lineColor: UP, topColor: `${UP}44`, bottomColor: `${UP}00`, lineWidth: 2 })
          : created.addSeries(LineSeries, { color: UP, lineWidth: 2 });
    series.current.applyOptions({ priceFormat: { type: 'price', precision, minMove: 10 ** -precision } });
    levelLines.current = [];
    return () => {
      created.remove();
      chart.current = null;
      series.current = null;
      levelLines.current = [];
    };
  }, [type, precision]);

  useEffect(() => {
    const target = series.current;
    const instance = chart.current;
    if (!target || !instance || candles.length === 0) return;
    // Las velas semanales de una década comparten fecha, no hora: mostrar la
    // hora en el eje llenaría todo de "00:00" sin decir nada.
    instance.applyOptions({ timeScale: { timeVisible: range.timeframe !== '1d' && range.timeframe !== '1w' } });
    const rising = candles[candles.length - 1].c >= candles[0].o;
    const color = rising ? UP : DOWN;
    if (type === 'candles') {
      target.setData(candles.map((c) => ({ time: (c.t / 1000) as UTCTimestamp, open: c.o, high: c.h, low: c.l, close: c.c })));
    } else {
      target.setData(candles.map((c) => ({ time: (c.t / 1000) as UTCTimestamp, value: c.c })));
      target.applyOptions(
        type === 'area' ? { lineColor: color, topColor: `${color}44`, bottomColor: `${color}00` } : { color },
      );
    }
    instance.timeScale().fitContent();
  }, [candles, type, range.timeframe]);

  useEffect(() => {
    const target = series.current;
    if (!target) return;
    for (const line of levelLines.current) target.removePriceLine(line);
    levelLines.current = levels.map((level) =>
      target.createPriceLine({
        price: level.price,
        title: level.label,
        color: level.tone === 'negative' ? DOWN : level.tone === 'positive' ? UP : '#94a7b8',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
      }),
    );
  }, [levels, type, candles]);

  const span =
    summary && summary.from
      ? `${new Date(summary.from).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })} → hoy`
      : null;

  return (
    <div className="history-chart" data-gesture-exclude data-state={state}>
      <div ref={host} className="history-chart-canvas" aria-label={`Historial de precios de ${symbol}`} />
      {state === 'loading' && candles.length === 0 && (
        <p className="history-chart-status" role="status">
          Trayendo el historial de {historyRange(rangeId).title}…
        </p>
      )}
      {state === 'error' && (
        <p className="history-chart-status is-error" role="status">
          {error}
        </p>
      )}
      {state === 'ready' && summary && (
        <p className="simple-market-source">
          {span} · {summary.points.toLocaleString('es-CO')} velas de {range.timeframe}
          {source ? ` · Fuente: ${source}` : ''}
        </p>
      )}
      <span className="sr-only">
        {summary
          ? `Variación de ${summary.changePercent.toFixed(2)} por ciento en ${range.title}.`
          : 'Historial en carga.'}
      </span>
    </div>
  );
}

export { HISTORY_RANGES };
