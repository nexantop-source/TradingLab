'use client';

import * as React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { IndicatorId, Timeframe } from '@tl/types';
import { Badge, Button, Field, Input, Segmented, Select, Textarea, Checkbox, cn, InfoTip } from '@tl/ui';
import { SimulationDisclaimer } from '@tl/ui/compliance';
import {
  HYPOTHESIS_DURATIONS,
  HYPOTHESIS_DURATION_LABEL,
  LEVERAGE_OPTIONS,
  MIN_STAKE_CENTS,
} from '@tl/simulation-engine';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { formatVirtualUsd } from '@/lib/format';
import type { TerminalSymbol } from './Terminal';

type Mode = 'HYPOTHESIS' | 'POSITION' | 'PORTFOLIO';
type Direction = 'BULLISH' | 'BEARISH';

const MODE_LABEL: Record<Mode, string> = {
  HYPOTHESIS: 'Hipótesis',
  POSITION: 'Posición',
  PORTFOLIO: 'Portafolio',
};

const CONFIDENCE_LABEL = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta' } as const;

const QUICK_AMOUNTS = [10, 25, 50, 100, 250];

/**
 * Panel de simulación.
 *
 * Decisiones de diseño explícitas del pliego:
 *  · Los botones se llaman «Crear hipótesis alcista/bajista», nunca «Arriba»
 *    o «Abajo», y no tienen forma de botones de apuesta.
 *  · Antes de confirmar se muestra siempre el resumen con el riesgo virtual,
 *    la condición de acierto y el aviso de simulación.
 *  · Nunca se coloca publicidad dentro de este panel (regla aplicada en
 *    `AdSlot`, que se niega a renderizar en la superficie del formulario).
 */
export function SimulationPanel({
  symbol,
  quote,
  timeframe,
  indicators,
  chartType,
  balanceCents,
  entitlements,
  portfolios,
  marketClosed,
  onLevelsChange,
  onCreated,
  onError,
}: {
  symbol: TerminalSymbol;
  quote: { price: number; bid: number; ask: number };
  timeframe: Timeframe;
  indicators: IndicatorId[];
  chartType: string;
  balanceCents: number;
  entitlements: {
    modes: Mode[];
    simulationsPerDay: number | null;
    simulationsUsedToday: number;
    planName: string;
  };
  portfolios: Array<{ id: string; name: string }>;
  marketClosed: boolean;
  onLevelsChange: (levels: Array<{ price: number; label: string; tone: 'positive' | 'negative' | 'neutral' }>) => void;
  onCreated: (result: { balanceCents: number }) => void;
  onError: (message: string) => void;
}) {
  const [mode, setMode] = React.useState<Mode>(entitlements.modes[0] ?? 'HYPOTHESIS');
  const [direction, setDirection] = React.useState<Direction>('BULLISH');
  const [amountUsd, setAmountUsd] = React.useState(50);
  const [durationMinutes, setDurationMinutes] = React.useState<number>(60);
  const [leverage, setLeverage] = React.useState(1);
  const [stopLoss, setStopLoss] = React.useState('');
  const [takeProfit, setTakeProfit] = React.useState('');
  const [rationale, setRationale] = React.useState('');
  const [confidence, setConfidence] = React.useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [perceivedRisk, setPerceivedRisk] = React.useState(3);
  const [portfolioId, setPortfolioId] = React.useState(portfolios[0]?.id ?? '');
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [fieldError, setFieldError] = React.useState<string | null>(null);

  const stakeCents = Math.round(amountUsd * 100);
  const limitReached =
    entitlements.simulationsPerDay != null &&
    entitlements.simulationsUsedToday >= entitlements.simulationsPerDay;

  // Los niveles introducidos se dibujan sobre el gráfico en tiempo real.
  React.useEffect(() => {
    if (mode !== 'POSITION') {
      onLevelsChange([]);
      return;
    }
    const levels: Array<{ price: number; label: string; tone: 'positive' | 'negative' | 'neutral' }> = [];
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    if (Number.isFinite(sl) && sl > 0) levels.push({ price: sl, label: 'Stop loss', tone: 'negative' });
    if (Number.isFinite(tp) && tp > 0) levels.push({ price: tp, label: 'Take profit', tone: 'positive' });
    onLevelsChange(levels);
  }, [mode, stopLoss, takeProfit, onLevelsChange]);

  const entryPrice = direction === 'BULLISH' ? quote.ask : quote.bid;
  const riskPercentOfBalance = balanceCents > 0 ? (stakeCents / balanceCents) * 100 : 0;
  const feeCents = Math.round((stakeCents * leverage * symbol.spreadBps) / 10000 / 2);

  const riskReward = React.useMemo(() => {
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    if (!Number.isFinite(sl) || !Number.isFinite(tp) || sl <= 0 || tp <= 0) return null;
    const isLong = direction === 'BULLISH';
    const risk = isLong ? entryPrice - sl : sl - entryPrice;
    const reward = isLong ? tp - entryPrice : entryPrice - tp;
    if (risk <= 0 || reward <= 0) return null;
    return Number((reward / risk).toFixed(2));
  }, [stopLoss, takeProfit, direction, entryPrice]);

  const maxRiskCents = React.useMemo(() => {
    const sl = Number(stopLoss);
    if (mode !== 'POSITION' || !Number.isFinite(sl) || sl <= 0) return stakeCents;
    const isLong = direction === 'BULLISH';
    const distance = isLong ? entryPrice - sl : sl - entryPrice;
    if (distance <= 0) return stakeCents;
    const quantity = (stakeCents * leverage) / 100 / entryPrice;
    return Math.min(stakeCents, Math.round(distance * quantity * 100));
  }, [mode, stopLoss, direction, entryPrice, stakeCents, leverage]);

  const expiresAt = React.useMemo(
    () => new Date(Date.now() + durationMinutes * 60000),
    [durationMinutes],
  );

  function validate(): string | null {
    if (marketClosed) return `El mercado de ${symbol.name} está cerrado. Horario de referencia: ${symbol.sessionLabel}.`;
    if (limitReached) {
      return `Has alcanzado el límite de ${entitlements.simulationsPerDay} simulaciones diarias del plan ${entitlements.planName}.`;
    }
    if (stakeCents < MIN_STAKE_CENTS) return 'El monto virtual mínimo es USD 1,00.';
    if (stakeCents > balanceCents) return 'No tienes saldo virtual suficiente para este monto.';
    if (rationale.trim().length < 15) {
      return 'Explica en al menos 15 caracteres por qué formulas esta hipótesis. Es parte del ejercicio.';
    }
    if (mode === 'POSITION') {
      const sl = Number(stopLoss);
      if (stopLoss && Number.isFinite(sl)) {
        if (direction === 'BULLISH' && sl >= entryPrice) {
          return 'En una posición alcista el stop loss debe situarse por debajo del precio de entrada.';
        }
        if (direction === 'BEARISH' && sl <= entryPrice) {
          return 'En una posición bajista el stop loss debe situarse por encima del precio de entrada.';
        }
      }
    }
    if (mode === 'PORTFOLIO' && !portfolioId) return 'Selecciona un portafolio DEMO.';
    return null;
  }

  function requestConfirmation(dir: Direction) {
    setDirection(dir);
    const error = validate();
    setFieldError(error);
    if (error) return;
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true);
    setFieldError(null);

    const common = {
      symbol: symbol.symbol,
      stakeCents,
      rationale: rationale.trim(),
      confidence,
      perceivedRisk,
      timeframe,
      visibleIndicators: indicators,
      chartType,
      acknowledgedSimulation: true as const,
    };

    const payload =
      mode === 'HYPOTHESIS'
        ? { ...common, mode: 'HYPOTHESIS' as const, direction, durationMinutes }
        : mode === 'POSITION'
          ? {
              ...common,
              mode: 'POSITION' as const,
              direction,
              orderType: 'MARKET' as const,
              limitPrice: null,
              leverage,
              stopLoss: stopLoss ? Number(stopLoss) : null,
              takeProfit: takeProfit ? Number(takeProfit) : null,
              trailingStopDistance: null,
            }
          : {
              ...common,
              mode: 'PORTFOLIO' as const,
              portfolioId,
              side: direction === 'BULLISH' ? ('BUY' as const) : ('SELL' as const),
            };

    try {
      const result = await apiFetch<{ balanceCents: number }>('/api/simulations', {
        method: 'POST',
        json: payload,
      });
      setConfirming(false);
      setAcknowledged(false);
      setRationale('');
      onCreated(result);
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : 'No se ha podido crear la simulación.';
      setFieldError(message);
      onError(message);
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4">
      {/* Modo */}
      <Segmented
        ariaLabel="Modo de simulación"
        className="w-full"
        options={(['HYPOTHESIS', 'POSITION', 'PORTFOLIO'] as Mode[]).map((m) => ({
          value: m,
          label: MODE_LABEL[m],
          title: entitlements.modes.includes(m) ? undefined : 'Disponible a partir del plan Standard',
        }))}
        value={mode}
        onChange={(m) => {
          if (!entitlements.modes.includes(m)) {
            onError(`El modo «${MODE_LABEL[m]}» está disponible a partir del plan Standard.`);
            return;
          }
          setMode(m);
        }}
      />

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">
        {mode === 'HYPOTHESIS' &&
          'Declaras una dirección y un plazo. Al vencer, se comprueba si el precio se movió en ese sentido y en qué medida.'}
        {mode === 'POSITION' &&
          'Posición simulada con stop loss, take profit y apalancamiento exclusivamente virtual.'}
        {mode === 'PORTFOLIO' &&
          'Compra o venta virtual al contado dentro de un portafolio DEMO, para estudiar diversificación.'}
      </p>

      {/* Monto */}
      <div className="mt-4">
        <Field
          label="Monto virtual"
          htmlFor="amount"
          hint={`Equivale al ${riskPercentOfBalance.toFixed(2)} % de tu saldo virtual.`}
        >
          <Input
            id="amount"
            type="number"
            min={1}
            step={1}
            value={amountUsd}
            onChange={(e) => setAmountUsd(Math.max(1, Number(e.target.value) || 0))}
            inputMode="decimal"
          />
        </Field>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmountUsd(a)}
              className={cn(
                'num rounded-[var(--radius-xs)] border px-2.5 py-1 text-[11px] transition-colors',
                amountUsd === a
                  ? 'border-[var(--color-blue)] text-[var(--color-blue)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {a}
            </button>
          ))}
        </div>
        {riskPercentOfBalance > 5 && (
          <p className="mt-2 rounded-[var(--radius-xs)] border border-[color-mix(in_srgb,var(--color-gold)_30%,transparent)] bg-[var(--color-gold-soft)] px-2.5 py-1.5 text-[11px] leading-relaxed text-[var(--color-muted)]">
            Estás comprometiendo el {riskPercentOfBalance.toFixed(1)} % de tu saldo en una sola simulación. La
            referencia habitual en gestión del riesgo es entre el 1 % y el 2 %.
          </p>
        )}
      </div>

      {/* Parámetros por modo */}
      {mode === 'HYPOTHESIS' && (
        <div className="mt-4">
          <Field label="Duración" htmlFor="duration">
            <Select
              id="duration"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            >
              {HYPOTHESIS_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {HYPOTHESIS_DURATION_LABEL[d]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {mode === 'POSITION' && (
        <div className="mt-4 space-y-3">
          <Field
            label="Apalancamiento simulado"
            htmlFor="leverage"
            hint="No mejora tu análisis: solo amplifica el efecto de cada error."
          >
            <Select id="leverage" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}>
              {LEVERAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {l}:1
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Stop loss" htmlFor="stopLoss">
              <Input
                id="stopLoss"
                type="number"
                step={10 ** -symbol.precision}
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="Opcional"
                inputMode="decimal"
              />
            </Field>
            <Field label="Take profit" htmlFor="takeProfit">
              <Input
                id="takeProfit"
                type="number"
                step={10 ** -symbol.precision}
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="Opcional"
                inputMode="decimal"
              />
            </Field>
          </div>

          {riskReward != null && (
            <p className="num text-[11px] text-[var(--color-muted)]">
              Relación riesgo-beneficio planificada:{' '}
              <span className={riskReward >= 1.5 ? 'text-[var(--color-positive)]' : 'text-[var(--color-gold)]'}>
                {riskReward}
              </span>
            </p>
          )}
          {!stopLoss && (
            <p className="text-[11px] leading-relaxed text-[var(--color-gold)]">
              Sin stop loss no tienes definido de antemano cuánto puedes perder. Es la variable que más pesa en tu
              puntuación de disciplina.
            </p>
          )}
        </div>
      )}

      {mode === 'PORTFOLIO' && (
        <div className="mt-4">
          <Field label="Portafolio DEMO" htmlFor="portfolio">
            <Select id="portfolio" value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {/* Razonamiento */}
      <div className="mt-4 space-y-3">
        <Field
          label="¿Por qué formulas esta hipótesis?"
          htmlFor="rationale"
          hint="Mínimo 15 caracteres. Incluye qué precio te demostraría que estás equivocado."
          required
        >
          <Textarea
            id="rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Ejemplo: el precio defiende la zona de soporte de ayer y la media de 20 acompaña. Invalido la idea si cierra por debajo del mínimo de la sesión."
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Confianza" htmlFor="confidence">
            <Select
              id="confidence"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
            >
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((c) => (
                <option key={c} value={c}>
                  {CONFIDENCE_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Riesgo percibido" htmlFor="perceivedRisk">
            <Select
              id="perceivedRisk"
              value={perceivedRisk}
              onChange={(e) => setPerceivedRisk(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r} de 5
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      {fieldError && (
        <p role="alert" className="mt-3 text-[12px] leading-relaxed text-[var(--color-negative)]">
          {fieldError}
        </p>
      )}

      {/* Acciones */}
      <div className="mt-5 space-y-2">
        <button
          type="button"
          onClick={() => requestConfirmation('BULLISH')}
          disabled={marketClosed || limitReached}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3.5 text-left transition-colors',
            'border-[color-mix(in_srgb,var(--color-positive)_35%,transparent)] bg-[var(--color-positive-soft)]',
            'hover:border-[var(--color-positive)] disabled:opacity-45 disabled:pointer-events-none',
          )}
        >
          <span>
            <span className="block text-[13px] font-semibold text-[var(--color-positive)]">
              Crear hipótesis alcista
            </span>
            <span className="num mt-0.5 block text-[10px] text-[var(--color-muted)]">
              Entrada estimada {quote.ask.toFixed(symbol.precision)}
            </span>
          </span>
          <TrendingUp className="size-5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => requestConfirmation('BEARISH')}
          disabled={marketClosed || limitReached}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border p-3.5 text-left transition-colors',
            'border-[color-mix(in_srgb,var(--color-negative)_35%,transparent)] bg-[var(--color-negative-soft)]',
            'hover:border-[var(--color-negative)] disabled:opacity-45 disabled:pointer-events-none',
          )}
        >
          <span>
            <span className="block text-[13px] font-semibold text-[var(--color-negative)]">
              Crear hipótesis bajista
            </span>
            <span className="num mt-0.5 block text-[10px] text-[var(--color-muted)]">
              Entrada estimada {quote.bid.toFixed(symbol.precision)}
            </span>
          </span>
          <TrendingDown className="size-5 shrink-0 text-[var(--color-negative)]" aria-hidden="true" />
        </button>
      </div>

      {limitReached && (
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-gold)]">
          Has usado las {entitlements.simulationsPerDay} simulaciones diarias del plan {entitlements.planName}. El
          contador se reinicia a las 00:00 UTC.{' '}
          <Link href="/precios" className="underline">
            Comparar planes
          </Link>
          .
        </p>
      )}

      <p className="mt-4 text-[10px] leading-relaxed text-[var(--color-subtle)]">
        Spread virtual del instrumento: {symbol.spreadBps} puntos básicos. Comisión estimada de apertura:{' '}
        <span className="num">{formatVirtualUsd(feeCents)}</span> VUSD.
      </p>

      {/* ── Confirmación ────────────────────────────────────────────────── */}
      {confirming && (
        <div className="fixed inset-0 z-60 flex items-end justify-center sm:items-center">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setConfirming(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar simulación"
            className="animate-sheet-up relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-elevated)] p-5 sm:rounded-[var(--radius-xl)]"
          >
            <h2 className="text-base font-semibold tracking-tight">
              Confirma tu {mode === 'HYPOTHESIS' ? 'hipótesis' : 'simulación'}{' '}
              {direction === 'BULLISH' ? 'alcista' : 'bajista'}
            </h2>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              {symbol.name} ({symbol.symbol}) · temporalidad {timeframe}
            </p>

            <dl className="mt-4 space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3.5 text-[12px]">
              <Row label="Precio inicial" value={entryPrice.toFixed(symbol.precision)} />
              {mode === 'HYPOTHESIS' && (
                <>
                  <Row
                    label="Hora de cierre"
                    value={expiresAt.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                  />
                  <Row
                    label="Condición de acierto"
                    value={
                      direction === 'BULLISH'
                        ? `Precio por encima de ${entryPrice.toFixed(symbol.precision)} al vencimiento`
                        : `Precio por debajo de ${entryPrice.toFixed(symbol.precision)} al vencimiento`
                    }
                  />
                </>
              )}
              {mode === 'POSITION' && (
                <>
                  <Row label="Apalancamiento simulado" value={`${leverage}:1`} />
                  <Row label="Stop loss" value={stopLoss ? Number(stopLoss).toFixed(symbol.precision) : 'sin definir'} />
                  <Row label="Take profit" value={takeProfit ? Number(takeProfit).toFixed(symbol.precision) : 'sin definir'} />
                  {riskReward != null && <Row label="Riesgo-beneficio" value={String(riskReward)} />}
                </>
              )}
              <Row label="Monto virtual comprometido" value={`${formatVirtualUsd(stakeCents)} VUSD`} />
              <Row
                label="Riesgo virtual máximo"
                value={`${formatVirtualUsd(maxRiskCents)} VUSD (${((maxRiskCents / balanceCents) * 100).toFixed(2)} % del saldo)`}
                emphasis
              />
              <Row label="Comisión virtual de apertura" value={`${formatVirtualUsd(feeCents)} VUSD`} />
            </dl>

            <div className="mt-4">
              <SimulationDisclaimer />
            </div>

            <div className="mt-4">
              <Checkbox
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                label="Entiendo que se trata de una simulación educativa con dinero virtual y que no se ejecuta ninguna orden en un mercado real."
              />
            </div>

            <div className="mt-5 flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setConfirming(false)}>
                Volver
              </Button>
              <Button
                fullWidth
                loading={submitting}
                disabled={!acknowledged}
                variant={direction === 'BULLISH' ? 'positive' : 'negative'}
                onClick={submit}
              >
                Confirmar simulación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className={cn('num text-right', emphasis ? 'font-semibold text-[var(--color-gold)]' : 'text-[var(--color-text)]')}>
        {value}
      </dd>
    </div>
  );
}
