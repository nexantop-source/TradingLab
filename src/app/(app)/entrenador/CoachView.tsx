'use client';

import * as React from 'react';
import Link from 'next/link';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, HelpCircle, BookOpen, ShieldCheck } from 'lucide-react';
import type { AIEducationalAnalysis, IndicatorId } from '@tl/types';
import { Badge, Button, Callout, Card, Field, Select, Textarea, Segmented, Progress, cn } from '@tl/ui';
import { AIDisclaimer } from '@tl/ui/compliance';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { formatVirtualUsd, formatRelative } from '@/lib/format';

type Kind = 'CHART_REVIEW' | 'POST_TRADE' | 'JOURNAL_REVIEW';

const KIND_LABEL: Record<Kind, string> = {
  CHART_REVIEW: 'Analizar un gráfico',
  POST_TRADE: 'Revisar una simulación',
  JOURNAL_REVIEW: 'Revisar mi diario',
};

const TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h', '1d'];

export function CoachView({
  symbols,
  defaultSymbol,
  defaultTimeframe,
  defaultKind,
  availableIndicators,
  usage,
  multiTimeframe,
  aiConfigured,
  history,
  closedSimulations,
}: {
  symbols: Array<{ symbol: string; name: string; minPlan: string }>;
  defaultSymbol: string;
  defaultTimeframe: string;
  defaultKind: Kind;
  availableIndicators: IndicatorId[];
  usage: { used: number; limit: number | null; period: string; planName: string };
  multiTimeframe: boolean;
  aiConfigured: boolean;
  history: Array<{
    id: string;
    kind: string;
    symbol: string | null;
    engine: string;
    createdAt: string;
    flagged: boolean;
    analysis: AIEducationalAnalysis | null;
  }>;
  closedSimulations: Array<{
    id: string;
    symbol: string;
    direction: string | null;
    outcome: string;
    closedAt: string | null;
    pnlCents: number | null;
  }>;
}) {
  const [kind, setKind] = React.useState<Kind>(defaultKind);
  const [symbol, setSymbol] = React.useState(defaultSymbol);
  const [timeframe, setTimeframe] = React.useState(defaultTimeframe);
  const [simulationId, setSimulationId] = React.useState(closedSimulations[0]?.id ?? '');
  const [question, setQuestion] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    analysis: AIEducationalAnalysis;
    engine: string;
    engineNotice: string;
    degraded: boolean;
  } | null>(null);

  const limitReached = usage.limit != null && usage.used >= usage.limit;

  async function request() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        analysis: AIEducationalAnalysis;
        engine: string;
        engineNotice: string;
        degraded: boolean;
      }>('/api/ai/analysis', {
        method: 'POST',
        json: {
          kind,
          symbol: kind === 'JOURNAL_REVIEW' ? undefined : symbol,
          timeframe: kind === 'JOURNAL_REVIEW' ? undefined : timeframe,
          indicators: availableIndicators.slice(0, 6),
          simulationId: kind === 'POST_TRADE' ? simulationId : undefined,
          question: question.trim() || undefined,
        },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido generar el análisis.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-[var(--color-violet)]" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Entrenador educativo</h1>
        </div>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Recibe del servidor los precios y los indicadores ya calculados. No puede inventarlos, no puede
          modificar el resultado de tus simulaciones y no puede darte una orden de compra o venta.
        </p>
      </header>

      {!aiConfigured && (
        <Callout tone="info" title="Motor educativo determinístico activo">
          No hay credencial de proveedor de inteligencia artificial configurada en este entorno, así que los
          análisis los genera el motor determinístico de TradingLab. Cumple exactamente las mismas reglas de
          conducta y usa las mismas lecturas de indicadores.
        </Callout>
      )}

      {/* Formulario */}
      <Card className="p-5">
        <Segmented
          ariaLabel="Tipo de análisis"
          className="w-full"
          options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={kind}
          onChange={setKind}
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {kind !== 'JOURNAL_REVIEW' && (
            <Field label="Instrumento" htmlFor="symbol">
              <Select id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
                {symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} · {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kind === 'CHART_REVIEW' && (
            <Field label="Temporalidad" htmlFor="timeframe">
              <Select id="timeframe" value={timeframe} onChange={(e) => setTimeframe(e.target.value)}>
                {TIMEFRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {kind === 'POST_TRADE' && (
            <Field label="Simulación cerrada" htmlFor="simulation">
              <Select id="simulation" value={simulationId} onChange={(e) => setSimulationId(e.target.value)}>
                {closedSimulations.length === 0 && <option value="">No tienes simulaciones cerradas</option>}
                {closedSimulations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.symbol} · {s.direction === 'BEARISH' ? 'bajista' : 'alcista'} ·{' '}
                    {(s.pnlCents ?? 0) >= 0 ? '+' : ''}
                    {formatVirtualUsd(s.pnlCents ?? 0)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field
          className="mt-3"
          label="¿Quieres preguntar algo concreto?"
          htmlFor="question"
          hint="Opcional. Formula una duda sobre lo que estás viendo; no responderá a peticiones de recomendación."
        >
          <Textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Ejemplo: ¿qué me está diciendo la diferencia entre las dos medias en este tramo?"
          />
        </Field>

        {error && (
          <Callout tone="danger" className="mt-4">
            {error}
          </Callout>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            loading={loading}
            disabled={limitReached || (kind === 'POST_TRADE' && !simulationId)}
            onClick={request}
          >
            <Sparkles className="size-4" aria-hidden="true" />
            Generar análisis educativo
          </Button>
          {usage.limit != null && (
            <span className="num text-[12px] text-[var(--color-muted)]">
              {usage.used} / {usage.limit} análisis {usage.period}s · plan {usage.planName}
            </span>
          )}
        </div>

        {usage.limit != null && (
          <Progress className="mt-3" value={usage.used} max={usage.limit} tone={limitReached ? 'gold' : 'violet'} label="Uso de análisis" />
        )}

        {limitReached && (
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-gold)]">
            Has agotado tus análisis {usage.period}s.{' '}
            <Link href="/precios" className="underline">
              Comparar planes
            </Link>
            .
          </p>
        )}

        {!multiTimeframe && kind === 'CHART_REVIEW' && (
          <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
            El análisis multitemporal, que compara varias escalas a la vez, está incluido en el plan Premium.
          </p>
        )}
      </Card>

      {/* Resultado */}
      {result && (
        <AnalysisCard
          analysis={result.analysis}
          engine={result.engine}
          notice={result.engineNotice}
          degraded={result.degraded}
        />
      )}

      {/* Historial */}
      {history.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold">Análisis anteriores</h2>
          <ul className="mt-3 space-y-2">
            {history.map((h) => (
              <li key={h.id}>
                <details className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-4 py-3 text-[13px]">
                    <Badge tone="violet">{KIND_LABEL[h.kind as Kind] ?? h.kind}</Badge>
                    {h.symbol && <span className="num font-medium">{h.symbol}</span>}
                    <span className="ml-auto text-[11px] text-[var(--color-subtle)]">
                      {formatRelative(h.createdAt)}
                    </span>
                  </summary>
                  {h.analysis && (
                    <div className="border-t border-[var(--color-border)] p-4">
                      <AnalysisBody analysis={h.analysis} />
                      <AIDisclaimer engine={h.engine} className="mt-4" />
                    </div>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function AnalysisCard({
  analysis,
  engine,
  notice,
  degraded,
}: {
  analysis: AIEducationalAnalysis;
  engine: string;
  notice: string;
  degraded: boolean;
}) {
  return (
    <Card elevated className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] px-5 py-3.5">
        <Sparkles className="size-4 text-[var(--color-violet)]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold">Análisis educativo</h2>
        <Badge
          tone={
            analysis.uncertaintyLevel === 'ALTA'
              ? 'gold'
              : analysis.uncertaintyLevel === 'MEDIA'
                ? 'blue'
                : 'neutral'
          }
          className="ml-auto"
        >
          Incertidumbre {analysis.uncertaintyLevel.toLowerCase()}
        </Badge>
      </div>

      <div className="p-5">
        {degraded && (
          <Callout tone="info" className="mb-4">
            {notice}
          </Callout>
        )}
        <AnalysisBody analysis={analysis} />
        <AIDisclaimer engine={engine} className="mt-5" />
      </div>
    </Card>
  );
}

function AnalysisBody({ analysis }: { analysis: AIEducationalAnalysis }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[14px] leading-relaxed">{analysis.contextSummary}</p>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-muted)]">{analysis.observedTrend}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <EvidenceBlock
          tone="positive"
          icon={<TrendingUp className="size-3.5" aria-hidden="true" />}
          title="Evidencias alcistas"
          items={analysis.bullishEvidence}
        />
        <EvidenceBlock
          tone="negative"
          icon={<TrendingDown className="size-3.5" aria-hidden="true" />}
          title="Evidencias bajistas"
          items={analysis.bearishEvidence}
        />
      </div>

      {analysis.relevantIndicators.length > 0 && (
        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Indicadores relevantes
          </h3>
          <ul className="mt-2.5 space-y-2.5">
            {analysis.relevantIndicators.map((ind) => (
              <li key={ind.name} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium">{ind.name}</span>
                  <span className="num text-[12px] text-[var(--color-blue)]">{ind.reading}</span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{ind.interpretation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ScenarioBlock title="Escenario alcista" body={analysis.bullishScenario} tone="positive" />
        <ScenarioBlock title="Escenario bajista" body={analysis.bearishScenario} tone="negative" />
      </div>

      <ListBlock
        icon={<AlertTriangle className="size-3.5" aria-hidden="true" />}
        title="Riesgos"
        items={analysis.risks}
        tone="gold"
      />

      <ListBlock
        icon={<ShieldCheck className="size-3.5" aria-hidden="true" />}
        title="Condiciones de invalidación"
        items={analysis.invalidationConditions}
        tone="blue"
      />

      <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-violet)_28%,transparent)] bg-[var(--color-violet-soft)] p-4">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-[var(--color-violet)]">
          <HelpCircle className="size-3.5" aria-hidden="true" />
          Preguntas para ti
        </h3>
        <ul className="mt-2.5 space-y-2">
          {analysis.questionsForStudent.map((q) => (
            <li key={q} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
              · {q}
            </li>
          ))}
        </ul>
      </div>

      {analysis.recommendedLesson && (
        <Link
          href={`/academia/leccion/${analysis.recommendedLesson.slug}`}
          className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] p-4 transition-colors hover:border-[var(--color-blue)]"
        >
          <BookOpen className="mt-0.5 size-4 shrink-0 text-[var(--color-blue)]" aria-hidden="true" />
          <span>
            <span className="block text-[13px] font-medium">{analysis.recommendedLesson.title}</span>
            <span className="mt-1 block text-[12px] leading-relaxed text-[var(--color-muted)]">
              {analysis.recommendedLesson.reason}
            </span>
          </span>
        </Link>
      )}

      {analysis.sourcesUsed.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-subtle)]">
            Fuentes utilizadas
          </h3>
          <ul className="mt-1.5 space-y-1">
            {analysis.sourcesUsed.map((s) => (
              <li key={s} className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
                · {s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EvidenceBlock({
  tone,
  icon,
  title,
  items,
}: {
  tone: 'positive' | 'negative';
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-md)] border p-4',
        tone === 'positive'
          ? 'border-[color-mix(in_srgb,var(--color-positive)_26%,transparent)] bg-[var(--color-positive-soft)]'
          : 'border-[color-mix(in_srgb,var(--color-negative)_26%,transparent)] bg-[var(--color-negative-soft)]',
      )}
    >
      <h3
        className={cn(
          'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider',
          tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
        )}
      >
        {icon}
        {title}
      </h3>
      <ul className="mt-2.5 space-y-2">
        {items.map((i) => (
          <li key={i} className="text-[12px] leading-relaxed text-[var(--color-muted)]">
            · {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioBlock({ title, body, tone }: { title: string; body: string; tone: 'positive' | 'negative' }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
      <h3
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          tone === 'positive' ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]',
        )}
      >
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

function ListBlock({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: 'gold' | 'blue';
}) {
  return (
    <div>
      <h3
        className={cn(
          'flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider',
          tone === 'gold' ? 'text-[var(--color-gold)]' : 'text-[var(--color-blue)]',
        )}
      >
        {icon}
        {title}
      </h3>
      <ul className="mt-2.5 space-y-2">
        {items.map((i) => (
          <li key={i} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
            · {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
