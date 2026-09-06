'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { interpolateEndpoint, type MarketTick } from './marketPulse';

export interface ChartLevel { price: number; label: string; tone?: 'positive' | 'negative' | 'neutral' }
export interface SimpleLiveChartProps {
  ticks: MarketTick[];
  symbol: string;
  precision: number;
  stale: boolean;
  reduceMotion: boolean;
  chartType?: 'line' | 'area';
  levels?: ChartLevel[];
  windowSeconds?: 60 | 120;
}

const LEFT = 10;
const TOP = 26;

function timeLabel(time: number) {
  return new Date(time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** A compact two-minute observation window. Only received points are rendered. */
export function SimpleLiveChart({ ticks, symbol, precision, stale, reduceMotion, chartType = 'area', levels = [], windowSeconds = 120 }: SimpleLiveChartProps) {
  const id = useId().replace(/:/g, '');
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(390);
  const W = Math.max(280, width);
  const H = W < 500 ? 210 : 320;
  const RIGHT = W - 102;
  const BOTTOM = H - 42;
  const [displayTicks, setDisplayTicks] = useState(ticks);
  const presented = useRef(ticks);
  const previousSymbol = useRef(symbol);
  const [inspected, setInspected] = useState<number | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0);
      if (measured > 0) setWidth(measured);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);

  useEffect(() => {
    let frame = 0;
    const prior = presented.current;
    const latest = ticks[ticks.length - 1];
    const last = prior[prior.length - 1];
    const symbolChanged = previousSymbol.current !== symbol;
    previousSymbol.current = symbol;
    const publish = (next: MarketTick[]) => { presented.current = next; setDisplayTicks(next); };
    if (!latest || !last || symbolChanged || reduceMotion || hidden || stale || latest.time - last.time > 2000 || latest.time < last.time) {
      publish(ticks);
      return;
    }
    const started = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - started) / 400);
      // Ease the received endpoint, never generate a tick in the next second.
      publish(interpolateEndpoint(ticks, last.price, 1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [ticks, symbol, reduceMotion, hidden, stale]);

  const model = useMemo(() => {
    // On a symbol transition the previous frame is never presented as the new asset.
    const points = previousSymbol.current === symbol ? displayTicks : ticks;
    if (!points.length) return null;
    const prices = points.map(point => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = Math.max((max - min) * 0.22, Math.pow(10, -precision) * 4, max * 0.000015);
    const low = min - pad;
    const high = max + pad;
    const end = points[points.length - 1].time;
    const start = end - windowSeconds * 1000;
    const x = (time: number) => LEFT + (time - start) / (windowSeconds * 1000) * (RIGHT - LEFT);
    const y = (price: number) => BOTTOM - (price - low) / (high - low) * (BOTTOM - TOP);
    // Straight joins preserve each observation. Rounded caps smooth the visual,
    // unlike splines that can overshoot actual maxima/minima.
    const path = points.map((point, index) => `${index ? 'L' : 'M'}${x(point.time).toFixed(2)},${y(point.price).toFixed(2)}`).join(' ');
    return { points, low, high, start, end, x, y, path, latest: points[points.length - 1] };
  }, [displayTicks, ticks, symbol, precision, windowSeconds, RIGHT, BOTTOM]);

  const format = (price: number) => price.toLocaleString('en-US', { minimumFractionDigits: precision, maximumFractionDigits: precision });
  const selected = model && inspected != null ? model.points[Math.min(inspected, model.points.length - 1)] : null;
  const lastReceived = ticks[ticks.length - 1];

  return <div ref={container} className="simple-live-chart" data-gesture-exclude data-stale={stale ? 'true' : undefined}>
    <div className="simple-live-chart__caption">
      <span><i aria-hidden="true" />{stale ? 'Última serie recibida' : 'Serie demo · cada segundo'}</span>
      <span>{windowSeconds === 60 ? '1 minuto' : '2 minutos'}</span>
    </div>
    {!model ? <div className="simple-live-chart__empty" role="status"><span className="simple-live-chart__empty-line" />Conectando con el motor educativo…</div> : <>
      <svg className="simple-live-chart__plot" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-title ${id}-desc`}
        onPointerMove={event => {
          if (event.pointerType === 'touch' && event.buttons === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const sx = (event.clientX - rect.left) / rect.width * W;
          const time = model.start + Math.max(0, Math.min(1, (sx - LEFT) / (RIGHT - LEFT))) * windowSeconds * 1000;
          const index = model.points.reduce((best, point, i) => Math.abs(point.time - time) < Math.abs(model.points[best].time - time) ? i : best, 0);
          setInspected(index);
        }} onPointerLeave={() => setInspected(null)} onPointerUp={() => setInspected(null)} onPointerCancel={() => setInspected(null)}>
        <title id={`${id}-title`}>Precio simulado de {symbol}</title>
        <desc id={`${id}-desc`}>Últimos {windowSeconds} segundos de la serie educativa. {lastReceived ? `Último precio recibido: ${format(lastReceived.price)}.` : ''} No son precios de un mercado real.</desc>
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".2" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient>
          <clipPath id={`${id}-clip`}><rect x={LEFT} y={TOP - 10} width={RIGHT - LEFT + 8} height={BOTTOM - TOP + 20} /></clipPath>
        </defs>
        {[0, 1, 2, 3].map(index => {
          const price = model.high - (model.high - model.low) * index / 3;
          const y = model.y(price);
          return <g key={index} className="simple-live-chart__grid"><line x1={LEFT} x2={RIGHT} y1={y} y2={y} /><text x={RIGHT + 16} y={y - 6}>{format(price)}</text></g>;
        })}
        <g clipPath={`url(#${id}-clip)`}>
          {chartType === 'area' && <path d={`${model.path} L${RIGHT},${BOTTOM} L${model.x(model.points[0].time)},${BOTTOM} Z`} fill={`url(#${id}-area)`} />}
          {levels.filter(level => Number.isFinite(level.price) && level.price >= model.low && level.price <= model.high).map((level, index) => <g key={`${level.label}-${index}`} className={`simple-live-chart__level simple-live-chart__level--${level.tone ?? 'neutral'}`}>
            <line x1={LEFT} x2={RIGHT} y1={model.y(level.price)} y2={model.y(level.price)} /><text x={LEFT + 6} y={model.y(level.price) - 7}>{level.label} {format(level.price)}</text>
          </g>)}
          <path className="simple-live-chart__line" d={model.path} />
          <line className="simple-live-chart__current-line" x1={LEFT} x2={RIGHT} y1={model.y(model.latest.price)} y2={model.y(model.latest.price)} />
          <circle className="simple-live-chart__halo" cx={RIGHT} cy={model.y(model.latest.price)} r="9" />
          <circle className="simple-live-chart__point" cx={RIGHT} cy={model.y(model.latest.price)} r="3.5" />
          {selected && <g className="simple-live-chart__crosshair"><line x1={model.x(selected.time)} x2={model.x(selected.time)} y1={TOP} y2={BOTTOM} /><circle cx={model.x(selected.time)} cy={model.y(selected.price)} r="4" /></g>}
        </g>
        <g className="simple-live-chart__price-label" transform={`translate(${RIGHT + 10} ${Math.min(BOTTOM - 12, Math.max(TOP + 10, model.y(model.latest.price))) - 12})`}>
          <rect width="90" height="25" rx="6" /><text x="45" y="16">{format(lastReceived?.price ?? model.latest.price)}</text>
        </g>
        {[0, 1, 2].map(index => <text className="simple-live-chart__time" key={index} x={LEFT + (RIGHT - LEFT) * index / 2} y={H - 16} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{timeLabel(model.start + index * windowSeconds * 500)}</text>)}
      </svg>
      <div className="simple-live-chart__inspection" aria-hidden={!selected}>{selected ? `${timeLabel(selected.time)} · ${format(selected.price)}` : 'Toca el gráfico para consultar un punto'}</div>
    </>}
  </div>;
}
