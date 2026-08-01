'use client';

import * as React from 'react';
import type { Candle, IndicatorId, Timeframe } from '@tl/types';
import { computeIndicators, toHeikinAshi } from '@tl/market-data/indicators';
import { cn } from '../cn';

/**
 * Gráfico de precios propio.
 *
 * Implementación original sobre `<canvas>`, sin bibliotecas de terceros. Esto
 * resuelve la sección 9 del pliego: no se integra ningún componente cuya
 * licencia exija atribuciones que después haya que ocultar. Si en el futuro se
 * adopta una biblioteca con licencia comercial, su atribución se renderiza en
 * `<ChartAttribution>` y nunca se tapa con overlays.
 *
 * Accesibilidad: el lienzo es decorativo (`aria-hidden`) y va acompañado de una
 * descripción textual y una tabla oculta con los últimos valores, de modo que
 * un lector de pantalla pueda acceder a la misma información.
 */

export type ChartType = 'candles' | 'line' | 'area' | 'heikin-ashi';

export interface TradeMarker {
  id: string;
  time: number;
  price: number;
  direction: 'BULLISH' | 'BEARISH';
  label: string;
  kind: 'ENTRY' | 'EXIT';
}

export interface EventMarker {
  time: number;
  title: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PriceChartProps {
  candles: Candle[];
  symbol: string;
  assetName: string;
  timeframe: Timeframe;
  precision: number;
  chartType?: ChartType;
  indicators?: IndicatorId[];
  markers?: TradeMarker[];
  events?: EventMarker[];
  /** Niveles horizontales: stop loss, take profit, entrada planificada. */
  levels?: Array<{ price: number; label: string; tone: 'positive' | 'negative' | 'neutral' }>;
  showVolume?: boolean;
  height?: number;
  className?: string;
  reduceMotion?: boolean;
  /** Se invoca al mover el cursor, para sincronizar la lectura numérica. */
  onCrosshair?: (candle: Candle | null) => void;
}

interface Viewport {
  /** Índice de la primera vela visible. */
  start: number;
  /** Número de velas visibles. */
  count: number;
}

const PADDING = { top: 16, right: 68, bottom: 26, left: 8 };
const VOLUME_RATIO = 0.16;
const PANE_RATIO = 0.2;
const MIN_CANDLES = 20;

export function PriceChart({
  candles,
  symbol,
  assetName,
  timeframe,
  precision,
  chartType = 'candles',
  indicators = [],
  markers = [],
  events = [],
  levels = [],
  showVolume = true,
  height = 460,
  className,
  reduceMotion = false,
  onCrosshair,
}: PriceChartProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = React.useState<Viewport | null>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const dragRef = React.useRef<{ x: number; start: number } | null>(null);

  // Datos derivados: Heikin-Ashi se calcula una vez.
  const data = React.useMemo(
    () => (chartType === 'heikin-ashi' ? toHeikinAshi(candles) : candles),
    [candles, chartType],
  );

  // Indicadores separados por ubicación.
  const paneIndicators = indicators.filter((i) => i === 'RSI14' || i === 'MACD' || i === 'STOCH14' || i === 'ATR14');
  const computed = React.useMemo(() => computeIndicators(candles, indicators), [candles, indicators]);

  // Ventana inicial: últimas 120 velas.
  React.useEffect(() => {
    if (data.length === 0) return;
    setViewport((v) => {
      if (v && v.start + v.count <= data.length) return v;
      const count = Math.min(120, data.length);
      return { start: Math.max(0, data.length - count), count };
    });
  }, [data.length]);

  const visible = React.useMemo(() => {
    if (!viewport || data.length === 0) return [];
    return data.slice(viewport.start, viewport.start + viewport.count);
  }, [data, viewport]);

  // ── Dibujo ────────────────────────────────────────────────────────────────
  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || visible.length === 0 || !viewport) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const cssHeight = height;
    canvas.width = width * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, cssHeight);

    const css = getComputedStyle(document.documentElement);
    const c = {
      text: css.getPropertyValue('--color-text').trim() || '#f8fafc',
      muted: css.getPropertyValue('--color-muted').trim() || '#98a4b7',
      border: css.getPropertyValue('--color-border').trim() || '#ffffff14',
      up: css.getPropertyValue('--color-positive').trim() || '#20d6a2',
      down: css.getPropertyValue('--color-negative').trim() || '#ff6178',
      blue: css.getPropertyValue('--color-blue').trim() || '#5b8cff',
      violet: css.getPropertyValue('--color-violet').trim() || '#8b5cf6',
      gold: css.getPropertyValue('--color-gold').trim() || '#f3b95f',
      surface: css.getPropertyValue('--color-surface').trim() || '#0d1320',
    };

    // Reparto vertical entre el panel de precio, el volumen y los paneles.
    const paneCount = paneIndicators.length;
    const volumeH = showVolume ? cssHeight * VOLUME_RATIO : 0;
    const panesH = paneCount > 0 ? cssHeight * PANE_RATIO * Math.min(paneCount, 2) : 0;
    const priceH = cssHeight - PADDING.top - PADDING.bottom - volumeH - panesH;

    const plotW = width - PADDING.left - PADDING.right;
    const slot = plotW / visible.length;
    const bodyW = Math.max(1, Math.min(slot * 0.68, 18));

    // Escala de precio con margen del 6 %.
    let min = Infinity;
    let max = -Infinity;
    for (const k of visible) {
      if (k.l < min) min = k.l;
      if (k.h > max) max = k.h;
    }
    for (const lv of levels) {
      if (lv.price < min) min = lv.price;
      if (lv.price > max) max = lv.price;
    }
    // Incluye las medias visibles en la escala para que no queden cortadas.
    const overlayKeys = Object.keys(computed.overlays) as IndicatorId[];
    for (const key of overlayKeys) {
      const s = computed.overlays[key];
      if (!s) continue;
      for (let i = viewport.start; i < viewport.start + visible.length; i++) {
        const v = s[i];
        if (v == null) continue;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const pad = (max - min) * 0.06 || max * 0.001 || 1;
    min -= pad;
    max += pad;

    const yOf = (price: number) => PADDING.top + ((max - price) / (max - min)) * priceH;
    const xOf = (i: number) => PADDING.left + i * slot + slot / 2;

    // ── Rejilla y eje de precios ───────────────────────────────────────────
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = c.muted;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const GRID_LINES = 6;
    for (let i = 0; i <= GRID_LINES; i++) {
      const price = min + ((max - min) * i) / GRID_LINES;
      const y = Math.round(yOf(price)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();
      ctx.fillText(price.toFixed(precision), width - PADDING.right + 8, y);
    }

    // ── Eje temporal ───────────────────────────────────────────────────────
    ctx.textAlign = 'center';
    const labelEvery = Math.max(1, Math.ceil(visible.length / 8));
    for (let i = 0; i < visible.length; i += labelEvery) {
      const x = xOf(i);
      const d = new Date(visible[i].t);
      const label =
        timeframe === '1d' || timeframe === '1w'
          ? `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
          : `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      ctx.fillStyle = c.muted;
      ctx.fillText(label, x, cssHeight - PADDING.bottom / 2);
      ctx.strokeStyle = c.border;
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, PADDING.top);
      ctx.lineTo(Math.round(x) + 0.5, PADDING.top + priceH);
      ctx.stroke();
    }

    // ── Eventos económicos ─────────────────────────────────────────────────
    for (const ev of events) {
      const idx = visible.findIndex((k, i) => {
        const next = visible[i + 1];
        return ev.time >= k.t && (!next || ev.time < next.t);
      });
      if (idx < 0) continue;
      const x = xOf(idx);
      ctx.strokeStyle = ev.impact === 'HIGH' ? c.gold : c.muted;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, PADDING.top + priceH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ev.impact === 'HIGH' ? c.gold : c.muted;
      ctx.beginPath();
      ctx.arc(x, PADDING.top + 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Bandas de Bollinger ────────────────────────────────────────────────
    if (computed.bollinger) {
      const { upper, lower, mid } = computed.bollinger;
      ctx.fillStyle = `${c.blue}14`;
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < visible.length; i++) {
        const v = upper[viewport.start + i];
        if (v == null) continue;
        const x = xOf(i);
        const y = yOf(v);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else ctx.lineTo(x, y);
      }
      for (let i = visible.length - 1; i >= 0; i--) {
        const v = lower[viewport.start + i];
        if (v == null) continue;
        ctx.lineTo(xOf(i), yOf(v));
      }
      ctx.closePath();
      ctx.fill();
      drawSeries(ctx, mid, viewport.start, visible.length, xOf, yOf, `${c.blue}88`, 1);
    }

    // ── Serie principal ────────────────────────────────────────────────────
    if (chartType === 'line' || chartType === 'area') {
      ctx.beginPath();
      for (let i = 0; i < visible.length; i++) {
        const x = xOf(i);
        const y = yOf(visible[i].c);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (chartType === 'area') {
        const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + priceH);
        grad.addColorStop(0, `${c.blue}52`);
        grad.addColorStop(1, `${c.blue}00`);
        ctx.save();
        ctx.lineTo(xOf(visible.length - 1), PADDING.top + priceH);
        ctx.lineTo(xOf(0), PADDING.top + priceH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        for (let i = 0; i < visible.length; i++) {
          const x = xOf(i);
          const y = yOf(visible[i].c);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = c.blue;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else {
      for (let i = 0; i < visible.length; i++) {
        const k = visible[i];
        const rising = k.c >= k.o;
        const color = rising ? c.up : c.down;
        const x = xOf(i);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, yOf(k.h));
        ctx.lineTo(Math.round(x) + 0.5, yOf(k.l));
        ctx.stroke();

        const yo = yOf(k.o);
        const yc = yOf(k.c);
        const top = Math.min(yo, yc);
        const h = Math.max(1, Math.abs(yc - yo));
        // Cuerpo relleno al alza, contorneado a la baja: la forma también
        // distingue dirección, no solo el color.
        if (rising) {
          ctx.fillStyle = color;
          ctx.fillRect(x - bodyW / 2, top, bodyW, h);
        } else {
          ctx.fillStyle = c.surface;
          ctx.fillRect(x - bodyW / 2, top, bodyW, h);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(x - bodyW / 2, top, bodyW, h);
        }
      }
    }

    // ── Medias móviles superpuestas ────────────────────────────────────────
    const overlayColors: Record<string, string> = {
      SMA20: c.blue,
      SMA50: c.violet,
      SMA200: c.gold,
      EMA12: `${c.up}cc`,
      EMA26: `${c.down}cc`,
      VWAP: `${c.text}88`,
    };
    for (const key of overlayKeys) {
      const s = computed.overlays[key];
      if (!s) continue;
      drawSeries(ctx, s, viewport.start, visible.length, xOf, yOf, overlayColors[key] ?? c.blue, 1.4);
    }

    // ── Niveles horizontales ───────────────────────────────────────────────
    for (const lv of levels) {
      const y = yOf(lv.price);
      if (y < PADDING.top || y > PADDING.top + priceH) continue;
      ctx.strokeStyle = lv.tone === 'positive' ? c.up : lv.tone === 'negative' ? c.down : c.muted;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lv.tone === 'positive' ? c.up : lv.tone === 'negative' ? c.down : c.muted;
      ctx.textAlign = 'left';
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.fillText(lv.label, PADDING.left + 4, y - 4);
    }

    // ── Marcadores de simulaciones ─────────────────────────────────────────
    for (const m of markers) {
      const idx = visible.findIndex((k, i) => {
        const next = visible[i + 1];
        return m.time >= k.t && (!next || m.time < next.t);
      });
      if (idx < 0) continue;
      const x = xOf(idx);
      const y = yOf(m.price);
      const up = m.direction === 'BULLISH';
      ctx.fillStyle = up ? c.up : c.down;
      ctx.beginPath();
      if (m.kind === 'ENTRY') {
        // Triángulo apuntando en el sentido de la hipótesis.
        if (up) {
          ctx.moveTo(x, y - 9);
          ctx.lineTo(x - 5, y - 1);
          ctx.lineTo(x + 5, y - 1);
        } else {
          ctx.moveTo(x, y + 9);
          ctx.lineTo(x - 5, y + 1);
          ctx.lineTo(x + 5, y + 1);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = c.surface;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // ── Precio actual ──────────────────────────────────────────────────────
    const last = visible[visible.length - 1];
    const lastY = yOf(last.c);
    const lastRising = last.c >= last.o;
    ctx.strokeStyle = lastRising ? c.up : c.down;
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, lastY);
    ctx.lineTo(width - PADDING.right, lastY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = lastRising ? c.up : c.down;
    ctx.fillRect(width - PADDING.right + 2, lastY - 8, PADDING.right - 6, 16);
    ctx.fillStyle = '#04121c';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(last.c.toFixed(precision), width - PADDING.right + 6, lastY);

    // ── Volumen ────────────────────────────────────────────────────────────
    if (showVolume && volumeH > 0) {
      const volTop = PADDING.top + priceH + 6;
      const maxVol = Math.max(...visible.map((k) => k.v)) || 1;
      for (let i = 0; i < visible.length; i++) {
        const k = visible[i];
        const h = ((k.v / maxVol) * (volumeH - 12)) | 0;
        ctx.fillStyle = k.c >= k.o ? `${c.up}59` : `${c.down}59`;
        ctx.fillRect(xOf(i) - bodyW / 2, volTop + (volumeH - 12) - h, bodyW, h);
      }
      ctx.fillStyle = c.muted;
      ctx.font = '9px ui-sans-serif, system-ui';
      ctx.textAlign = 'left';
      ctx.fillText('Volumen', PADDING.left + 2, volTop + 6);
    }

    // ── Paneles inferiores ─────────────────────────────────────────────────
    let paneTop = PADDING.top + priceH + volumeH + 6;
    const paneH = paneCount > 0 ? panesH / Math.min(paneCount, 2) - 8 : 0;

    for (const ind of paneIndicators.slice(0, 2)) {
      drawPane(ctx, {
        indicator: ind,
        computed,
        start: viewport.start,
        count: visible.length,
        x0: PADDING.left,
        y0: paneTop,
        w: plotW,
        h: paneH,
        colors: c,
        xOf,
      });
      paneTop += paneH + 8;
    }

    // ── Cruz y lectura ─────────────────────────────────────────────────────
    if (cursor && hoverIndex != null && visible[hoverIndex]) {
      const x = xOf(hoverIndex);
      ctx.strokeStyle = `${c.muted}80`;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, cssHeight - PADDING.bottom);
      ctx.moveTo(PADDING.left, cursor.y);
      ctx.lineTo(width - PADDING.right, cursor.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Etiqueta de precio bajo el cursor.
      const priceAtCursor = max - ((cursor.y - PADDING.top) / priceH) * (max - min);
      if (cursor.y >= PADDING.top && cursor.y <= PADDING.top + priceH) {
        ctx.fillStyle = c.muted;
        ctx.fillRect(width - PADDING.right + 2, cursor.y - 8, PADDING.right - 6, 16);
        ctx.fillStyle = c.surface;
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.fillText(priceAtCursor.toFixed(precision), width - PADDING.right + 6, cursor.y);
      }
    }
  }, [
    visible,
    viewport,
    chartType,
    computed,
    cursor,
    hoverIndex,
    events,
    height,
    levels,
    markers,
    paneIndicators,
    precision,
    showVolume,
    timeframe,
  ]);

  React.useEffect(() => {
    draw();
    const ro = new ResizeObserver(() => draw());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [draw]);

  // Redibuja al cambiar de tema.
  React.useEffect(() => {
    const observer = new MutationObserver(() => draw());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, [draw]);

  // ── Interacción ───────────────────────────────────────────────────────────
  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCursor({ x, y });

    if (dragRef.current && viewport) {
      const dx = x - dragRef.current.x;
      const slot = (rect.width - PADDING.left - PADDING.right) / viewport.count;
      const shift = Math.round(dx / slot);
      const start = Math.max(0, Math.min(data.length - viewport.count, dragRef.current.start - shift));
      setViewport({ ...viewport, start });
      return;
    }

    if (!viewport) return;
    const plotW = rect.width - PADDING.left - PADDING.right;
    const slot = plotW / viewport.count;
    const idx = Math.floor((x - PADDING.left) / slot);
    const clamped = Math.max(0, Math.min(visible.length - 1, idx));
    setHoverIndex(clamped);
    onCrosshair?.(visible[clamped] ?? null);
  };

  const handleLeave = () => {
    setCursor(null);
    setHoverIndex(null);
    dragRef.current = null;
    onCrosshair?.(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!viewport) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.15 : 0.87;
    const count = Math.round(Math.max(MIN_CANDLES, Math.min(data.length, viewport.count * factor)));
    const center = viewport.start + viewport.count / 2;
    const start = Math.max(0, Math.min(data.length - count, Math.round(center - count / 2)));
    setViewport({ start, count });
  };

  const zoom = (factor: number) => {
    if (!viewport) return;
    const count = Math.round(Math.max(MIN_CANDLES, Math.min(data.length, viewport.count * factor)));
    const start = Math.max(0, Math.min(data.length - count, viewport.start + (viewport.count - count) / 2));
    setViewport({ start: Math.round(start), count });
  };

  const resetView = () => {
    const count = Math.min(120, data.length);
    setViewport({ start: Math.max(0, data.length - count), count });
  };

  const hovered = hoverIndex != null ? visible[hoverIndex] : null;
  const last = visible[visible.length - 1] ?? null;
  const first = visible[0] ?? null;
  const periodChange =
    first && last ? Number((((last.c - first.c) / first.c) * 100).toFixed(2)) : 0;

  return (
    <div className={cn('relative w-full', className)}>
      <div ref={containerRef} className="relative w-full select-none">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="block w-full cursor-crosshair touch-pan-y"
          style={{ height }}
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
          onPointerDown={(e) => {
            if (!viewport) return;
            const rect = e.currentTarget.getBoundingClientRect();
            dragRef.current = { x: e.clientX - rect.left, start: viewport.start };
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onWheel={handleWheel}
        />

        {/* Lectura numérica sincronizada con el cursor */}
        {hovered && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-elevated)_88%,transparent)] px-2.5 py-1.5 backdrop-blur-sm">
            <div className="num flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-muted)]">
              <span>
                A <span className="text-[var(--color-text)]">{hovered.o.toFixed(precision)}</span>
              </span>
              <span>
                M <span className="text-[var(--color-text)]">{hovered.h.toFixed(precision)}</span>
              </span>
              <span>
                m <span className="text-[var(--color-text)]">{hovered.l.toFixed(precision)}</span>
              </span>
              <span>
                C <span className="text-[var(--color-text)]">{hovered.c.toFixed(precision)}</span>
              </span>
              <span>
                V <span className="text-[var(--color-text)]">{hovered.v.toLocaleString('es-ES')}</span>
              </span>
            </div>
          </div>
        )}

        {/* Controles de zoom */}
        <div className="absolute bottom-8 right-20 flex gap-1">
          <ChartButton onClick={() => zoom(0.8)} label="Acercar">
            +
          </ChartButton>
          <ChartButton onClick={() => zoom(1.25)} label="Alejar">
            −
          </ChartButton>
          <ChartButton onClick={resetView} label="Restablecer vista">
            ⤢
          </ChartButton>
        </div>
      </div>

      {/* Alternativa textual accesible */}
      <div className="sr-only">
        <h4>{`Gráfico de ${assetName} (${symbol}), temporalidad ${timeframe}`}</h4>
        <p>
          {last
            ? `Último cierre ${last.c.toFixed(precision)}. En el periodo visible, de ${visible.length} velas, la variación acumulada es de ${periodChange} por ciento.`
            : 'Sin datos disponibles.'}
        </p>
        <table>
          <caption>Últimas cinco velas del periodo visible</caption>
          <thead>
            <tr>
              <th scope="col">Hora</th>
              <th scope="col">Apertura</th>
              <th scope="col">Máximo</th>
              <th scope="col">Mínimo</th>
              <th scope="col">Cierre</th>
            </tr>
          </thead>
          <tbody>
            {visible.slice(-5).map((k) => (
              <tr key={k.t}>
                <td>{new Date(k.t).toISOString()}</td>
                <td>{k.o.toFixed(precision)}</td>
                <td>{k.h.toFixed(precision)}</td>
                <td>{k.l.toFixed(precision)}</td>
                <td>{k.c.toFixed(precision)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChartButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-7 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-elevated)_80%,transparent)] text-xs text-[var(--color-muted)] backdrop-blur-sm transition-colors hover:text-[var(--color-text)]"
    >
      {children}
    </button>
  );
}

function drawSeries(
  ctx: CanvasRenderingContext2D,
  series: Array<number | null>,
  start: number,
  count: number,
  xOf: (i: number) => number,
  yOf: (v: number) => number,
  color: string,
  lineWidth: number,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < count; i++) {
    const v = series[start + i];
    if (v == null) {
      started = false;
      continue;
    }
    const x = xOf(i);
    const y = yOf(v);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawPane(
  ctx: CanvasRenderingContext2D,
  p: {
    indicator: IndicatorId;
    computed: ReturnType<typeof computeIndicators>;
    start: number;
    count: number;
    x0: number;
    y0: number;
    w: number;
    h: number;
    colors: Record<string, string>;
    xOf: (i: number) => number;
  },
): void {
  const { indicator, computed, start, count, x0, y0, w, h, colors, xOf } = p;
  if (h <= 0) return;

  ctx.strokeStyle = colors.border;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
  ctx.fillStyle = colors.muted;
  ctx.font = '9px ui-sans-serif, system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(indicator, x0 + 4, y0 + 10);

  const values: Array<Array<number | null>> = [];
  let min = 0;
  let max = 100;

  if (indicator === 'RSI14' && computed.rsi) {
    values.push(computed.rsi);
    min = 0;
    max = 100;
    // Bandas de referencia en 30 y 70.
    ctx.strokeStyle = `${colors.muted}44`;
    ctx.setLineDash([2, 3]);
    for (const level of [30, 70]) {
      const y = y0 + h - ((level - min) / (max - min)) * h;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  } else if (indicator === 'STOCH14' && computed.stochastic) {
    values.push(computed.stochastic.k, computed.stochastic.d);
    min = 0;
    max = 100;
  } else if (indicator === 'MACD' && computed.macd) {
    values.push(computed.macd.line, computed.macd.signal);
    const all = [...computed.macd.line, ...computed.macd.signal].filter((v): v is number => v != null);
    if (all.length) {
      min = Math.min(...all);
      max = Math.max(...all);
      const pad = (max - min) * 0.15 || 0.0001;
      min -= pad;
      max += pad;
    }
    // Histograma.
    const hist = computed.macd.histogram;
    const zeroY = y0 + h - ((0 - min) / (max - min)) * h;
    const slot = w / count;
    for (let i = 0; i < count; i++) {
      const v = hist[start + i];
      if (v == null) continue;
      const y = y0 + h - ((v - min) / (max - min)) * h;
      ctx.fillStyle = v >= 0 ? `${colors.up}66` : `${colors.down}66`;
      ctx.fillRect(xOf(i) - slot * 0.3, Math.min(y, zeroY), slot * 0.6, Math.abs(zeroY - y) || 1);
    }
  } else if (indicator === 'ATR14' && computed.atr) {
    values.push(computed.atr);
    const all = computed.atr.filter((v): v is number => v != null);
    if (all.length) {
      min = Math.min(...all) * 0.9;
      max = Math.max(...all) * 1.1;
    }
  }

  const paneColors = [colors.blue, colors.gold];
  values.forEach((s, i) => {
    drawSeries(
      ctx,
      s,
      start,
      count,
      xOf,
      (v) => y0 + h - ((v - min) / (max - min)) * h,
      paneColors[i] ?? colors.blue,
      1.2,
    );
  });
}

/**
 * Bloque de atribución del proveedor de datos y del componente de gráfico.
 *
 * Regla de cumplimiento: este bloque nunca debe ocultarse con CSS, opacidad,
 * capas superpuestas ni manipulación del DOM. Si se adopta una biblioteca de
 * terceros con atribución obligatoria, su enlace se renderiza aquí.
 */
export function ChartAttribution({
  providerLabel,
  attribution,
  className,
}: {
  providerLabel: string;
  attribution?: { text: string; url: string } | null;
  className?: string;
}) {
  return (
    <p className={cn('text-[10px] text-[var(--color-subtle)]', className)}>
      Gráfico propio de TradingLab · Datos: {providerLabel}
      {attribution && (
        <>
          {' · '}
          <a
            href={attribution.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-[var(--color-muted)]"
          >
            {attribution.text}
          </a>
        </>
      )}
    </p>
  );
}
