'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NotebookPen, Plus, Sparkles } from 'lucide-react';
import { Badge, Button, Callout, Card, Field, Input, Select, Textarea, Tabs, EmptyState, cn } from '@tl/ui';
import { EMOTIONS, EMOTION_LABEL, type Emotion } from '@tl/types';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { formatVirtualUsd, formatDateTime } from '@/lib/format';

interface JournalEntry {
  id: string;
  title: string;
  hypothesis: string;
  entryReason: string;
  emotionBefore: string;
  emotionAfter: string | null;
  riskLevel: number;
  indicatorsUsed: string[];
  result: string | null;
  mistake: string | null;
  lesson: string | null;
  tags: string[];
  createdAt: string;
  simulation: {
    id: string;
    symbol: string;
    direction: string | null;
    outcome: string;
    pnlCents: number | null;
    stakeCents: number;
    entryPrice: number;
    exitPrice: number | null;
    stopLoss: number | null;
    leverage: number;
    precision: number;
  } | null;
}

interface PendingSimulation {
  id: string;
  symbol: string;
  direction: string | null;
  outcome: string;
  pnlCents: number | null;
  rationale: string;
  closedAt: string | null;
  hadStopLoss: boolean;
}

export function JournalView({
  entries,
  pending,
  preselected,
  timezone,
}: {
  entries: JournalEntry[];
  pending: PendingSimulation[];
  preselected: { id: string; symbol: string; direction: string | null; rationale: string; outcome: string } | null;
  timezone: string;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<'entradas' | 'pendientes' | 'patrones'>(
    preselected ? 'pendientes' : 'entradas',
  );
  const [composing, setComposing] = React.useState<string | null>(preselected?.id ?? null);
  const [filterTag, setFilterTag] = React.useState<string | null>(null);
  const [filterEmotion, setFilterEmotion] = React.useState<string | null>(null);

  const allTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [entries]);

  const patterns = React.useMemo(() => computePatterns(entries), [entries]);

  const visible = entries.filter(
    (e) =>
      (!filterTag || e.tags.includes(filterTag)) &&
      (!filterEmotion || e.emotionBefore === filterEmotion || e.emotionAfter === filterEmotion),
  );

  return (
    <div className="app-content-page mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="app-page-kicker">Reflexionar</p>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">Diario educativo</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
            El historial registra qué pasó. El diario registra por qué decidiste lo que decidiste, que es lo único
            que puedes mejorar deliberadamente.
          </p>
        </div>
        <Button size="sm" onClick={() => setComposing('new')}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva entrada
        </Button>
      </header>

      <Tabs
        ariaLabel="Secciones del diario"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'entradas', label: 'Entradas', count: entries.length },
          { id: 'pendientes', label: 'Sin documentar', count: pending.length },
          { id: 'patrones', label: 'Patrones' },
        ]}
      />

      {composing && (
        <ComposeForm
          simulationId={composing === 'new' ? null : composing}
          preselected={composing === preselected?.id ? preselected : null}
          onClose={() => setComposing(null)}
          onSaved={() => {
            setComposing(null);
            router.refresh();
          }}
        />
      )}

      {/* ── Entradas ─────────────────────────────────────────────────────── */}
      {tab === 'entradas' && (
        <>
          {(allTags.length > 0 || entries.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFilterTag(null);
                  setFilterEmotion(null);
                }}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px]',
                  !filterTag && !filterEmotion
                    ? 'border-[var(--color-blue)] text-[var(--color-blue)]'
                    : 'border-[var(--color-border)] text-[var(--color-muted)]',
                )}
              >
                Todas
              </button>
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px]',
                    filterTag === tag
                      ? 'border-[var(--color-blue)] text-[var(--color-blue)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted)]',
                  )}
                >
                  {tag} <span className="num text-[var(--color-subtle)]">{count}</span>
                </button>
              ))}
              <Select
                aria-label="Filtrar por emoción"
                className="h-8 w-auto text-[11px]"
                value={filterEmotion ?? ''}
                onChange={(e) => setFilterEmotion(e.target.value || null)}
              >
                <option value="">Cualquier emoción</option>
                {EMOTIONS.map((e) => (
                  <option key={e} value={e}>
                    {EMOTION_LABEL[e]}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={<NotebookPen className="size-5" />}
                title="Tu diario está vacío"
                description="Documenta tu próxima simulación: la hipótesis, la emoción antes de abrir y qué precio te habría demostrado que estabas equivocado."
                action={<Button size="sm" onClick={() => setComposing('new')}>Escribir la primera entrada</Button>}
              />
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((e) => (
                <li key={e.id}>
                  <EntryCard entry={e} timezone={timezone} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── Pendientes ───────────────────────────────────────────────────── */}
      {tab === 'pendientes' && (
        <>
          <Callout tone="info" title="Documenta mientras lo recuerdas">
            Estas simulaciones ya están cerradas pero no tienen entrada de diario. Registrarlas ahora, con el
            contexto fresco, es lo que después permite detectar patrones.
          </Callout>

          {pending.length === 0 ? (
            <Card>
              <EmptyState
                icon={<NotebookPen className="size-5" />}
                title="No tienes simulaciones sin documentar"
                description="Todas tus simulaciones cerradas tienen su entrada correspondiente."
              />
            </Card>
          ) : (
            <ul className="space-y-2">
              {pending.map((s) => (
                <li key={s.id}>
                  <Card className="flex flex-wrap items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="num flex items-center gap-2 text-[13px] font-medium">
                        {s.symbol}
                        <Badge tone={s.direction === 'BEARISH' ? 'negative' : 'positive'}>
                          {s.direction === 'BEARISH' ? 'Bajista' : 'Alcista'}
                        </Badge>
                        {!s.hadStopLoss && <Badge tone="gold">Sin stop loss</Badge>}
                      </span>
                      <span className="mt-1 block truncate text-[12px] text-[var(--color-muted)]">
                        {s.rationale}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'num text-[13px] font-medium',
                        (s.pnlCents ?? 0) > 0
                          ? 'text-[var(--color-positive)]'
                          : (s.pnlCents ?? 0) < 0
                            ? 'text-[var(--color-negative)]'
                            : 'text-[var(--color-muted)]',
                      )}
                    >
                      {(s.pnlCents ?? 0) >= 0 ? '+' : ''}
                      {formatVirtualUsd(s.pnlCents ?? 0)}
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => setComposing(s.id)}>
                      Documentar
                    </Button>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* ── Patrones ─────────────────────────────────────────────────────── */}
      {tab === 'patrones' && (
        <div className="space-y-4">
          {entries.length < 5 ? (
            <Callout tone="info" title="Todavía no hay suficientes entradas">
              A partir de cinco entradas empezaremos a mostrarte los patrones que se repiten: emociones asociadas
              a peores decisiones, errores recurrentes y etiquetas más frecuentes.
            </Callout>
          ) : (
            <>
              <Card className="p-5">
                <h2 className="text-[14px] font-semibold">Emociones y resultado del proceso</h2>
                <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                  Compara en qué estado emocional tomas tus decisiones y qué proporción de ellas incluyó stop loss
                  y un motivo detallado.
                </p>
                <ul className="mt-4 space-y-2">
                  {patterns.byEmotion.map((p) => (
                    <li key={p.emotion} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-[12px]">{EMOTION_LABEL[p.emotion as Emotion] ?? p.emotion}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-overlay)]">
                        <span
                          className="block h-full rounded-full bg-[var(--color-blue)]"
                          style={{ width: `${p.qualityPercent}%` }}
                        />
                      </span>
                      <span className="num w-20 text-right text-[11px] text-[var(--color-muted)]">
                        {p.qualityPercent} % · {p.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>

              {patterns.repeatedMistakes.length > 0 && (
                <Card className="p-5">
                  <h2 className="text-[14px] font-semibold">Errores que se repiten</h2>
                  <ul className="mt-3 space-y-2">
                    {patterns.repeatedMistakes.map((m) => (
                      <li key={m.text} className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] leading-relaxed text-[var(--color-muted)]">{m.text}</span>
                        <Badge tone="gold">{m.count} veces</Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Card className="p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[var(--color-violet)]" aria-hidden="true" />
                  <h2 className="text-[14px] font-semibold">Revisión del entrenador</h2>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
                  El entrenador puede revisar tu diario completo y señalar hasta tres patrones de conducta, cada
                  uno respaldado por una cifra concreta de tus estadísticas.
                </p>
                <Link href="/entrenador?tipo=diario" className="mt-4 inline-block">
                  <Button size="sm">Pedir una revisión del diario</Button>
                </Link>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function EntryCard({ entry, timezone }: { entry: JournalEntry; timezone: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="flex-1 text-[14px] font-semibold">{entry.title}</h3>
          {entry.simulation && (
            <span
              className={cn(
                'num text-[13px] font-medium',
                (entry.simulation.pnlCents ?? 0) > 0
                  ? 'text-[var(--color-positive)]'
                  : (entry.simulation.pnlCents ?? 0) < 0
                    ? 'text-[var(--color-negative)]'
                    : 'text-[var(--color-muted)]',
              )}
            >
              {(entry.simulation.pnlCents ?? 0) >= 0 ? '+' : ''}
              {formatVirtualUsd(entry.simulation.pnlCents ?? 0)}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--color-subtle)]">
            {formatDateTime(entry.createdAt, timezone)}
          </span>
          <Badge tone="neutral">Antes: {EMOTION_LABEL[entry.emotionBefore as Emotion] ?? entry.emotionBefore}</Badge>
          {entry.emotionAfter && (
            <Badge tone="neutral">
              Después: {EMOTION_LABEL[entry.emotionAfter as Emotion] ?? entry.emotionAfter}
            </Badge>
          )}
          {entry.tags.map((t) => (
            <Badge key={t} tone="blue">
              {t}
            </Badge>
          ))}
        </div>
        {!open && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
            {entry.hypothesis}
          </p>
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-[var(--color-border)] px-5 py-4">
          <Section title="Hipótesis" body={entry.hypothesis} />
          <Section title="Motivo de entrada" body={entry.entryReason} />
          {entry.simulation && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">Simulación asociada</p>
              <dl className="num mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-4">
                <Pair label="Instrumento" value={entry.simulation.symbol} />
                <Pair
                  label="Entrada"
                  value={entry.simulation.entryPrice.toFixed(entry.simulation.precision)}
                />
                <Pair
                  label="Salida"
                  value={entry.simulation.exitPrice?.toFixed(entry.simulation.precision) ?? '—'}
                />
                <Pair
                  label="Stop loss"
                  value={entry.simulation.stopLoss?.toFixed(entry.simulation.precision) ?? 'sin definir'}
                />
              </dl>
            </div>
          )}
          {entry.indicatorsUsed.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                Indicadores utilizados
              </p>
              <p className="num mt-1 text-[12px] text-[var(--color-muted)]">
                {entry.indicatorsUsed.join(' · ')}
              </p>
            </div>
          )}
          {entry.mistake && <Section title="Error identificado" body={entry.mistake} tone="negative" />}
          {entry.lesson && <Section title="Lección aprendida" body={entry.lesson} tone="positive" />}
        </div>
      )}
    </Card>
  );
}

function Section({ title, body, tone }: { title: string; body: string; tone?: 'positive' | 'negative' }) {
  return (
    <div>
      <p
        className={cn(
          'text-[10px] uppercase tracking-wider',
          tone === 'positive'
            ? 'text-[var(--color-positive)]'
            : tone === 'negative'
              ? 'text-[var(--color-negative)]'
              : 'text-[var(--color-subtle)]',
        )}
      >
        {title}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] text-[var(--color-subtle)]">{label}</dt>
      <dd className="text-[var(--color-text)]">{value}</dd>
    </div>
  );
}

function ComposeForm({
  simulationId,
  preselected,
  onClose,
  onSaved,
}: {
  simulationId: string | null;
  preselected: { symbol: string; direction: string | null; rationale: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(e.currentTarget);

    try {
      await apiFetch('/api/journal', {
        method: 'POST',
        json: {
          simulationId,
          title: String(data.get('title') ?? ''),
          hypothesis: String(data.get('hypothesis') ?? ''),
          entryReason: String(data.get('entryReason') ?? ''),
          emotionBefore: String(data.get('emotionBefore') ?? 'CALMADO'),
          emotionAfter: String(data.get('emotionAfter') ?? '') || null,
          riskLevel: Number(data.get('riskLevel') ?? 3),
          indicatorsUsed: [],
          result: String(data.get('result') ?? '') || null,
          mistake: String(data.get('mistake') ?? '') || null,
          lesson: String(data.get('lesson') ?? '') || null,
          tags: String(data.get('tags') ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido guardar la entrada.');
      setSubmitting(false);
    }
  }

  return (
    <Card elevated className="p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">
          {simulationId ? 'Documentar simulación' : 'Nueva entrada de diario'}
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>

      {error && (
        <Callout tone="danger" className="mt-4">
          {error}
        </Callout>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
        <Field label="Título" htmlFor="title" required>
          <Input
            id="title"
            name="title"
            required
            maxLength={140}
            defaultValue={preselected ? `Hipótesis en ${preselected.symbol}` : ''}
            placeholder="Ejemplo: prueba de soporte en EUR/USD"
          />
        </Field>

        <Field
          label="Hipótesis"
          htmlFor="hypothesis"
          hint="Formúlala de manera que se pueda comprobar si fue correcta o no."
          required
        >
          <Textarea
            id="hypothesis"
            name="hypothesis"
            required
            rows={3}
            defaultValue={preselected?.rationale ?? ''}
          />
        </Field>

        <Field label="Motivo de entrada" htmlFor="entryReason" required>
          <Textarea id="entryReason" name="entryReason" required rows={2} defaultValue={preselected?.rationale ?? ''} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Emoción antes" htmlFor="emotionBefore" required>
            <Select id="emotionBefore" name="emotionBefore" defaultValue="CALMADO">
              {EMOTIONS.map((e) => (
                <option key={e} value={e}>
                  {EMOTION_LABEL[e]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Emoción después" htmlFor="emotionAfter">
            <Select id="emotionAfter" name="emotionAfter" defaultValue="">
              <option value="">Sin registrar</option>
              {EMOTIONS.map((e) => (
                <option key={e} value={e}>
                  {EMOTION_LABEL[e]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Riesgo percibido" htmlFor="riskLevel">
            <Select id="riskLevel" name="riskLevel" defaultValue="3">
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r} de 5
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Error identificado" htmlFor="mistake" hint="Si no hubo ninguno, déjalo vacío.">
          <Textarea id="mistake" name="mistake" rows={2} />
        </Field>

        <Field label="Lección aprendida" htmlFor="lesson">
          <Textarea id="lesson" name="lesson" rows={2} />
        </Field>

        <Field label="Etiquetas de estrategia" htmlFor="tags" hint="Separadas por comas. Ejemplo: ruptura, rango.">
          <Input id="tags" name="tags" placeholder="ruptura, gestión del riesgo" />
        </Field>

        <input type="hidden" name="result" value="" />

        <Button type="submit" fullWidth loading={submitting}>
          Guardar entrada
        </Button>
      </form>
    </Card>
  );
}

/**
 * Patrones del diario.
 *
 * La «calidad» de una entrada se mide por el proceso documentado, no por el
 * resultado: que exista lección aprendida, que la hipótesis sea suficientemente
 * detallada y que la simulación asociada tuviera stop loss.
 */
function computePatterns(entries: JournalEntry[]) {
  const byEmotionMap = new Map<string, { count: number; quality: number }>();

  for (const e of entries) {
    const key = e.emotionBefore;
    const current = byEmotionMap.get(key) ?? { count: 0, quality: 0 };
    let quality = 0;
    if (e.hypothesis.length >= 80) quality += 1;
    if (e.lesson) quality += 1;
    if (e.simulation?.stopLoss != null) quality += 1;
    byEmotionMap.set(key, { count: current.count + 1, quality: current.quality + quality });
  }

  const byEmotion = Array.from(byEmotionMap.entries())
    .map(([emotion, v]) => ({
      emotion,
      count: v.count,
      qualityPercent: Math.round((v.quality / (v.count * 3)) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const mistakeCounts = new Map<string, number>();
  for (const e of entries) {
    if (!e.mistake) continue;
    const key = e.mistake.trim().toLowerCase();
    mistakeCounts.set(key, (mistakeCounts.get(key) ?? 0) + 1);
  }

  const repeatedMistakes = Array.from(mistakeCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([text, count]) => ({ text: text.charAt(0).toUpperCase() + text.slice(1), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return { byEmotion, repeatedMistakes };
}
