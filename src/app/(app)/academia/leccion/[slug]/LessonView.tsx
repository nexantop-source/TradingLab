'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight, Lightbulb, Target, ListChecks, AlertTriangle } from 'lucide-react';
import type { Candle, LessonBlock } from '@tl/types';
import { Badge, Button, Callout, Card, PriceChart, Progress, cn } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import { AdSlot } from '@/components/AdSlot';

interface QuizPublicQuestion {
  id: string;
  prompt: string;
  options: string[];
}

interface QuizResult {
  score: number;
  passed: boolean;
  passingScore: number;
  correct: number;
  total: number;
  improvement: number | null;
  detail: Array<{
    id: string;
    prompt: string;
    chosenIndex: number;
    correctIndex: number;
    correct: boolean;
    explanation: string;
  }>;
}

export function LessonView({
  lesson,
  trackTitle,
  trackSlug,
  moduleTitle,
  quiz,
  bestScore,
  quizPassed,
  completed,
  hasSimulations,
  chartData,
  previous,
  next,
}: {
  lesson: {
    slug: string;
    title: string;
    summary: string;
    estimatedMinutes: number;
    requiresSimulation: boolean;
    topic: string;
    blocks: LessonBlock[];
  };
  trackTitle: string;
  trackSlug: string;
  moduleTitle: string;
  quiz: { passingScore: number; questions: QuizPublicQuestion[] } | null;
  bestScore: number | null;
  quizPassed: boolean;
  completed: boolean;
  hasSimulations: boolean;
  chartData: Record<string, { candles: Candle[]; precision: number; name: string }>;
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<number[]>(Array(quiz?.questions.length ?? 0).fill(-1));
  const [result, setResult] = React.useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [isCompleted, setIsCompleted] = React.useState(completed);
  const [error, setError] = React.useState<string | null>(null);

  // Marca la lección como iniciada al abrirla.
  React.useEffect(() => {
    void apiFetch('/api/academy/progress', {
      method: 'POST',
      json: { lessonSlug: lesson.slug, status: 'IN_PROGRESS' },
    }).catch(() => null);
  }, [lesson.slug]);

  async function submitQuiz() {
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<QuizResult>('/api/academy/quiz', {
        method: 'POST',
        json: { lessonSlug: lesson.slug, answers },
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido corregir el cuestionario.');
    } finally {
      setSubmitting(false);
    }
  }

  async function markComplete() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/api/academy/progress', {
        method: 'POST',
        json: { lessonSlug: lesson.slug, status: 'COMPLETED' },
      });
      setIsCompleted(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido guardar el progreso.');
    } finally {
      setSubmitting(false);
    }
  }

  const quizSolved = quizPassed || result?.passed;
  const canComplete = (!quiz || quizSolved) && (!lesson.requiresSimulation || hasSimulations);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav aria-label="Ruta de navegación" className="text-[12px] text-[var(--color-muted)]">
        <Link href="/academia" className="hover:text-[var(--color-text)]">
          Academia
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/academia/${trackSlug}`} className="hover:text-[var(--color-text)]">
          {trackTitle}
        </Link>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{moduleTitle}</Badge>
          <span className="num text-[11px] text-[var(--color-subtle)]">{lesson.estimatedMinutes} min</span>
          {isCompleted && <Badge tone="positive">Completada</Badge>}
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">{lesson.title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{lesson.summary}</p>
      </header>

      {/* ── Contenido ─────────────────────────────────────────────────── */}
      <article className="mt-8 space-y-6">
        {lesson.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} chartData={chartData} />
        ))}
      </article>

      {/* ── Cuestionario ──────────────────────────────────────────────── */}
      {quiz && (
        <section className="mt-10" aria-labelledby="cuestionario">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="cuestionario" className="text-[15px] font-semibold">
                Comprueba tu comprensión
              </h2>
              {bestScore != null && (
                <Badge tone={quizPassed ? 'positive' : 'gold'}>Mejor resultado: {bestScore} %</Badge>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">
              Necesitas al menos un {quiz.passingScore} % para dar la lección por completada. Puedes repetirlo las
              veces que quieras.
            </p>

            <ol className="mt-6 space-y-6">
              {quiz.questions.map((q, qi) => {
                const detail = result?.detail.find((d) => d.id === q.id);
                return (
                  <li key={q.id}>
                    <fieldset>
                      <legend className="text-[14px] font-medium leading-snug">
                        <span className="num mr-2 text-[var(--color-subtle)]">{qi + 1}.</span>
                        {q.prompt}
                      </legend>
                      <div className="mt-3 space-y-2">
                        {q.options.map((option, oi) => {
                          const chosen = answers[qi] === oi;
                          const isCorrect = detail?.correctIndex === oi;
                          const isWrongChoice = detail && detail.chosenIndex === oi && !detail.correct;
                          return (
                            <button
                              key={option}
                              type="button"
                              disabled={Boolean(result)}
                              aria-pressed={chosen}
                              onClick={() =>
                                setAnswers((prev) => {
                                  const nextAnswers = [...prev];
                                  nextAnswers[qi] = oi;
                                  return nextAnswers;
                                })
                              }
                              className={cn(
                                'w-full rounded-[var(--radius-sm)] border p-3 text-left text-[13px] leading-snug transition-colors',
                                result
                                  ? isCorrect
                                    ? 'border-[var(--color-positive)] bg-[var(--color-positive-soft)]'
                                    : isWrongChoice
                                      ? 'border-[var(--color-negative)] bg-[var(--color-negative-soft)]'
                                      : 'border-[var(--color-border)] opacity-60'
                                  : chosen
                                    ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                              )}
                            >
                              {option}
                              {result && isCorrect && (
                                <span className="ml-2 text-[11px] font-medium text-[var(--color-positive)]">
                                  correcta
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {detail && (
                        <p className="mt-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[12px] leading-relaxed text-[var(--color-muted)]">
                          {detail.explanation}
                        </p>
                      )}
                    </fieldset>
                  </li>
                );
              })}
            </ol>

            {error && (
              <p role="alert" className="mt-4 text-[12px] text-[var(--color-negative)]">
                {error}
              </p>
            )}

            {!result ? (
              <Button
                className="mt-6"
                fullWidth
                loading={submitting}
                disabled={answers.some((a) => a < 0)}
                onClick={submitQuiz}
              >
                Corregir cuestionario
              </Button>
            ) : (
              <div className="mt-6 space-y-3">
                <Callout tone={result.passed ? 'success' : 'warning'} title={`Resultado: ${result.score} %`}>
                  {result.correct} de {result.total} respuestas correctas.{' '}
                  {result.passed
                    ? 'Has superado el cuestionario.'
                    : `Necesitas un ${result.passingScore} % para superarlo. Revisa las explicaciones y vuelve a intentarlo.`}
                  {result.improvement != null && result.improvement !== 0 && (
                    <>
                      {' '}
                      Respecto a tu mejor intento anterior: {result.improvement > 0 ? '+' : ''}
                      {result.improvement} puntos.
                    </>
                  )}
                </Callout>
                {!result.passed && (
                  <Button
                    variant="secondary"
                    fullWidth
                    onClick={() => {
                      setResult(null);
                      setAnswers(Array(quiz.questions.length).fill(-1));
                    }}
                  >
                    Volver a intentarlo
                  </Button>
                )}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* ── Requisitos y finalización ─────────────────────────────────── */}
      <section className="mt-8">
        {lesson.requiresSimulation && !hasSimulations && (
          <Callout tone="warning" title="Esta lección incluye un ejercicio práctico" className="mb-4">
            Para darla por completada necesitas haber creado al menos una simulación. Ve a la terminal, aplica lo
            que acabas de leer y documenta el motivo.{' '}
            <Link href="/terminal" className="underline">
              Abrir la terminal
            </Link>
            .
          </Callout>
        )}

        {isCompleted ? (
          <Callout tone="success" title="Lección completada">
            Has demostrado comprensión de este contenido. Puedes volver a consultarla cuando quieras.
          </Callout>
        ) : (
          <Button size="lg" fullWidth disabled={!canComplete} loading={submitting} onClick={markComplete}>
            <Check className="size-4" aria-hidden="true" />
            Marcar como completada
          </Button>
        )}
      </section>

      <AdSlot code="lesson-sponsor" page="lesson" topic={lesson.topic} className="mt-8" />

      {/* ── Navegación ────────────────────────────────────────────────── */}
      <nav aria-label="Lecciones" className="mt-8 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-6">
        {previous ? (
          <Link href={`/academia/leccion/${previous.slug}`} className="flex-1">
            <Button variant="secondary" fullWidth>
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span className="truncate">{previous.title}</span>
            </Button>
          </Link>
        ) : (
          <Link href={`/academia/${trackSlug}`} className="flex-1">
            <Button variant="secondary" fullWidth>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver a la ruta
            </Button>
          </Link>
        )}
        {next && (
          <Link href={`/academia/leccion/${next.slug}`} className="flex-1">
            <Button fullWidth>
              <span className="truncate">{next.title}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        )}
      </nav>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function BlockRenderer({
  block,
  chartData,
}: {
  block: LessonBlock;
  chartData: Record<string, { candles: Candle[]; precision: number; name: string }>;
}) {
  switch (block.type) {
    case 'text':
      return (
        <div>
          {block.title && <h2 className="mb-2.5 text-[16px] font-semibold tracking-tight">{block.title}</h2>}
          <div className="space-y-3.5">
            {block.body.split('\n\n').map((p, i) => (
              <p key={i} className="text-[14px] leading-[1.75] text-[var(--color-muted)]">
                {p}
              </p>
            ))}
          </div>
        </div>
      );

    case 'callout': {
      const icons = {
        info: <Lightbulb className="size-4" aria-hidden="true" />,
        warning: <AlertTriangle className="size-4" aria-hidden="true" />,
        success: <Check className="size-4" aria-hidden="true" />,
        danger: <AlertTriangle className="size-4" aria-hidden="true" />,
      };
      const tone = block.tone ?? 'info';
      return (
        <Callout tone={tone} title={block.title} icon={icons[tone]}>
          {block.body.split('\n\n').map((p, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {p}
            </p>
          ))}
        </Callout>
      );
    }

    case 'example':
      return (
        <Card className="border-l-2 border-l-[var(--color-violet)] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-violet)]">
            {block.title ?? 'Ejemplo'}
          </p>
          <div className="mt-2.5 space-y-3">
            {block.body.split('\n\n').map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                {p}
              </p>
            ))}
          </div>
        </Card>
      );

    case 'exercise':
      return (
        <Card className="border-[color-mix(in_srgb,var(--color-blue)_28%,transparent)] bg-[var(--color-blue-soft)] p-5">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-blue)]">
            <Target className="size-3.5" aria-hidden="true" />
            {block.title ?? 'Ejercicio'}
          </p>
          <div className="mt-2.5 space-y-3">
            {block.body.split('\n\n').map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-[var(--color-muted)]">
                {p}
              </p>
            ))}
          </div>
          <Link href="/terminal" className="mt-4 inline-block">
            <Button size="sm" variant="secondary">
              Abrir la terminal
            </Button>
          </Link>
        </Card>
      );

    case 'checklist':
      return (
        <Card className="p-5">
          <p className="flex items-center gap-2 text-[13px] font-semibold">
            <ListChecks className="size-4 text-[var(--color-muted)]" aria-hidden="true" />
            {block.title ?? 'Puntos clave'}
          </p>
          <ul className="mt-3 space-y-2">
            {(block.items ?? []).map((item) => (
              <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-blue)]"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      );

    case 'chart': {
      const key = `${block.symbol}:${block.timeframe ?? '1h'}`;
      const data = chartData[key];
      if (!data || !block.symbol) return null;
      return (
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <p className="text-[13px] font-semibold">{block.title ?? 'Gráfico'}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">{block.body}</p>
          </div>
          <PriceChart
            candles={data.candles}
            symbol={block.symbol}
            assetName={data.name}
            timeframe={block.timeframe ?? '1h'}
            precision={data.precision}
            chartType="candles"
            height={260}
            showVolume={false}
          />
          <p className="px-4 pb-3 text-[10px] text-[var(--color-subtle)]">
            Serie generada por el motor educativo determinístico de TradingLab, con fines ilustrativos.
          </p>
        </Card>
      );
    }

    case 'video':
      return (
        <Card className="p-5">
          <p className="text-[13px] font-semibold">{block.title ?? 'Vídeo'}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-muted)]">{block.body}</p>
          <p className="mt-3 text-[11px] text-[var(--color-subtle)]">
            Los vídeos incluyen subtítulos y transcripción completa. Contenido en preparación.
          </p>
        </Card>
      );

    default:
      return null;
  }
}
