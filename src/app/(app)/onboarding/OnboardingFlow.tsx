'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Badge, Button, Callout, Card, Progress, cn } from '@tl/ui';
import { VirtualBalance } from '@tl/ui/compliance';
import { ASSET_CLASSES, ASSET_CLASS_LABEL, type AssetClass } from '@tl/types';
import { apiFetch, ApiRequestError } from '@/lib/client-api';

interface Question {
  id: string;
  prompt: string;
  options: string[];
}

interface ClassificationResult {
  level: string;
  headline: string;
  recommendation: string;
  recommendedTrack: string;
}

type Step = 'bienvenida' | 'intereses' | 'objetivo' | 'evaluacion' | 'resultado';

const STEPS: Step[] = ['bienvenida', 'intereses', 'objetivo', 'evaluacion', 'resultado'];

/**
 * Onboarding educativo.
 *
 * Deliberadamente no agresivo: sin cuenta atrás, sin ofertas, sin presión para
 * operar. Termina recomendando una ruta de estudio, no una simulación.
 */
export function OnboardingFlow({
  userName,
  questions,
  goals,
  availability,
  tracks,
}: {
  userName: string;
  questions: Question[];
  goals: Array<{ value: string; label: string }>;
  availability: Array<{ value: number; label: string }>;
  tracks: Array<{ slug: string; title: string; summary: string; lessons: number; minutes: number }>;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('bienvenida');
  const [interests, setInterests] = React.useState<AssetClass[]>([]);
  const [goal, setGoal] = React.useState(goals[0]?.value ?? '');
  const [weekly, setWeekly] = React.useState(availability[1]?.value ?? 3);
  const [answers, setAnswers] = React.useState<number[]>(Array(questions.length).fill(-1));
  const [current, setCurrent] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    score: number;
    classification: ClassificationResult;
    rationales: Array<{ prompt: string; chosen: string; points: number; rationale: string }>;
  } | null>(null);

  const stepIndex = STEPS.indexOf(step);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiFetch<{
        score: number;
        classification: ClassificationResult;
        rationales: Array<{ prompt: string; chosen: string; points: number; rationale: string }>;
      }>('/api/me/onboarding', {
        method: 'POST',
        json: {
          experienceLevel: 'PRINCIPIANTE',
          marketInterests: interests,
          educationalGoal: goal,
          weeklyAvailability: weekly,
          assessmentAnswers: answers,
        },
      });
      setResult(data);
      setStep('resultado');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'No se ha podido guardar tu configuración.');
    } finally {
      setSubmitting(false);
    }
  }

  const recommendedTrack = result
    ? tracks.find((t) => t.slug === result.classification.recommendedTrack) ?? tracks[0]
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <Progress value={stepIndex + 1} max={STEPS.length} label="Progreso de la configuración inicial" />
        <p className="num mt-2 text-[11px] text-[var(--color-subtle)]">
          Paso {stepIndex + 1} de {STEPS.length}
        </p>
      </div>

      {error && (
        <Callout tone="danger" title="No se ha podido continuar" className="mb-5">
          {error}
        </Callout>
      )}

      {/* ── Bienvenida ─────────────────────────────────────────────────── */}
      {step === 'bienvenida' && (
        <Card className="p-7">
          <h1 className="text-2xl font-semibold tracking-[-0.02em]">
            Bienvenido, {userName.split(' ')[0]}
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">
            Antes de empezar vamos a hacer dos cosas: conocer qué te interesa y comprobar qué sabes ya sobre
            riesgo. Con eso te recomendaremos por dónde empezar.
          </p>

          <div className="mt-6 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--color-gold)_24%,transparent)] bg-[var(--color-gold-soft)] p-4">
            <VirtualBalance cents={1_000_000} size="lg" />
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">
              Ya está en tu cuenta. Es una unidad de cuenta pedagógica: no es dinero real, no es convertible y no
              puede retirarse. Existe para que puedas equivocarte sin consecuencias económicas.
            </p>
          </div>

          <ul className="mt-6 space-y-2.5">
            {[
              'No es un broker: no ejecutamos órdenes en mercados reales.',
              'No admitimos depósitos ni permitimos retiros.',
              'La inteligencia artificial es un tutor, no un asesor financiero.',
              'Ninguna simulación predice lo que hará el mercado.',
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-[13px] leading-snug text-[var(--color-muted)]">
                <Check className="mt-0.5 size-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>

          <Button className="mt-7" size="lg" fullWidth onClick={() => setStep('intereses')}>
            Empezar
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </Card>
      )}

      {/* ── Intereses ──────────────────────────────────────────────────── */}
      {step === 'intereses' && (
        <Card className="p-7">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">¿Qué mercados quieres estudiar?</h1>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Selecciona al menos uno. Podrás cambiarlo cuando quieras desde tu perfil.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {ASSET_CLASSES.filter((c) => c !== 'ETF').map((c) => {
              const active = interests.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setInterests((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
                  }
                  className={cn(
                    'rounded-[var(--radius-md)] border p-4 text-left transition-colors',
                    active
                      ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  <span className="block text-[14px] font-medium">{ASSET_CLASS_LABEL[c]}</span>
                  <span className="mt-1 block text-[11px] text-[var(--color-muted)]">
                    {MARKET_HINT[c]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex gap-2">
            <Button variant="secondary" onClick={() => setStep('bienvenida')}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
            <Button fullWidth disabled={interests.length === 0} onClick={() => setStep('objetivo')}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {/* ── Objetivo ───────────────────────────────────────────────────── */}
      {step === 'objetivo' && (
        <Card className="p-7">
          <h1 className="text-xl font-semibold tracking-[-0.02em]">¿Qué quieres conseguir?</h1>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            Nos ayuda a ordenar el contenido, no a prometerte un resultado.
          </p>

          <div className="mt-5 space-y-2">
            {goals.map((g) => (
              <button
                key={g.value}
                type="button"
                aria-pressed={goal === g.value}
                onClick={() => setGoal(g.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border p-3.5 text-left text-[13px] transition-colors',
                  goal === g.value
                    ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          <h2 className="mt-7 text-[14px] font-semibold">¿Cuánto tiempo puedes dedicarle?</h2>
          <div className="mt-3 space-y-2">
            {availability.map((a) => (
              <button
                key={a.value}
                type="button"
                aria-pressed={weekly === a.value}
                onClick={() => setWeekly(a.value)}
                className={cn(
                  'w-full rounded-[var(--radius-md)] border p-3 text-left text-[13px] transition-colors',
                  weekly === a.value
                    ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>

          <div className="mt-7 flex gap-2">
            <Button variant="secondary" onClick={() => setStep('intereses')}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
            <Button fullWidth onClick={() => setStep('evaluacion')}>
              Continuar
            </Button>
          </div>
        </Card>
      )}

      {/* ── Evaluación ─────────────────────────────────────────────────── */}
      {step === 'evaluacion' && (
        <Card className="p-7">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-[-0.02em]">Evaluación inicial</h1>
            <Badge tone="blue">
              {current + 1} / {questions.length}
            </Badge>
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-muted)]">
            No hay respuestas que te penalicen. Si no lo sabes, márcalo: nos permite ajustar mejor tu ruta.
          </p>

          <fieldset className="mt-6">
            <legend className="text-[15px] font-medium leading-snug">{questions[current].prompt}</legend>
            <div className="mt-4 space-y-2">
              {questions[current].options.map((option, i) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={answers[current] === i}
                  onClick={() => {
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[current] = i;
                      return next;
                    });
                    if (current < questions.length - 1) {
                      setTimeout(() => setCurrent((c) => c + 1), 180);
                    }
                  }}
                  className={cn(
                    'w-full rounded-[var(--radius-md)] border p-3.5 text-left text-[13px] leading-snug transition-colors',
                    answers[current] === i
                      ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-7 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => (current > 0 ? setCurrent((c) => c - 1) : setStep('objetivo'))}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Atrás
            </Button>
            {current < questions.length - 1 ? (
              <Button fullWidth disabled={answers[current] < 0} onClick={() => setCurrent((c) => c + 1)}>
                Siguiente
              </Button>
            ) : (
              <Button
                fullWidth
                loading={submitting}
                disabled={answers.some((a) => a < 0)}
                onClick={submit}
              >
                Ver mi resultado
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* ── Resultado ──────────────────────────────────────────────────── */}
      {step === 'resultado' && result && (
        <div className="space-y-4">
          <Card className="p-7">
            <Badge tone="violet">Nivel {result.classification.level.toLowerCase()}</Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
              {result.classification.headline}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">
              {result.classification.recommendation}
            </p>

            {recommendedTrack && (
              <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
                  Ruta recomendada
                </p>
                <p className="mt-1.5 text-[15px] font-semibold">{recommendedTrack.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">
                  {recommendedTrack.summary}
                </p>
                <p className="num mt-2 text-[11px] text-[var(--color-subtle)]">
                  {recommendedTrack.lessons} lecciones · {recommendedTrack.minutes} minutos aproximados
                </p>
              </div>
            )}

            <Callout tone="info" className="mt-5" title="Un paso antes de la terminal">
              Te recomendamos completar la primera lección antes de crear tu primera simulación. La terminal es
              más útil cuando sabes qué estás mirando.
            </Callout>

            <div className="mt-6 flex flex-wrap gap-2">
              <Link href={recommendedTrack ? `/academia/${recommendedTrack.slug}` : '/academia'} className="flex-1">
                <Button fullWidth size="lg">
                  Empezar mi ruta
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </Link>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  router.push('/panel');
                  router.refresh();
                }}
              >
                Ir al panel
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-[14px] font-semibold">Repaso de tus respuestas</h2>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Independientemente de lo que hayas contestado, conviene tener claras estas ideas.
            </p>
            <ul className="mt-4 space-y-4">
              {result.rationales.map((r) => (
                <li key={r.prompt} className="border-l-2 border-[var(--color-border-strong)] pl-3.5">
                  <p className="text-[12px] font-medium leading-snug">{r.prompt}</p>
                  <p className="mt-1 text-[11px] text-[var(--color-subtle)]">Tu respuesta: {r.chosen}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-muted)]">{r.rationale}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}

const MARKET_HINT: Record<string, string> = {
  FOREX: 'Divisas. Muy líquido y sensible a los bancos centrales.',
  CRYPTO: 'Activos digitales. Abierto siempre y muy volátil.',
  STOCK: 'Acciones de empresas cotizadas.',
  INDEX: 'Cestas que resumen un mercado completo.',
  COMMODITY: 'Metales y energía, con lógica de oferta física.',
  ETF: 'Fondos cotizados. Próximamente.',
};
