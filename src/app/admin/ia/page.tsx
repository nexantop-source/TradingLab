import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { fromJson } from '@/lib/json';
import { monthlyCap, monthlyCostUsd } from '@/lib/ai-budget';
import { PROMPT_VERSIONS, isAIConfigured } from '@tl/ai';
import { AI_PROHIBITED_BEHAVIORS } from '@tl/types/compliance';
import { Badge, Card, Callout, Progress } from '@tl/ui';
import { formatDateTime, formatUsd } from '@/lib/format';
import type { GuardrailReport } from '@tl/ai';

export const metadata: Metadata = { title: 'Inteligencia artificial' };
export const dynamic = 'force-dynamic';

export default async function AdminAIPage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'ai:read')) redirect('/panel');

  const month = new Date().toISOString().slice(0, 7);

  const [byKind, byEngine, topUsers, flagged, cost, totalCalls, ratings] = await Promise.all([
    db.aIAnalysis.groupBy({ by: ['kind'], _count: { _all: true }, _sum: { costUsd: true } }),
    db.aIAnalysis.groupBy({ by: ['engine'], _count: { _all: true } }),
    db.aIUsage.findMany({
      where: { month },
      orderBy: { calls: 'desc' },
      take: 12,
      include: { user: { select: { email: true } } },
    }),
    db.aIAnalysis.findMany({
      where: { flagged: true },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: { select: { email: true } } },
    }),
    monthlyCostUsd(true),
    db.aIAnalysis.count(),
    db.aIAnalysis.groupBy({ by: ['helpful'], _count: { _all: true } }),
  ]);

  const cap = monthlyCap();
  const helpfulYes = ratings.find((r) => r.helpful === true)?._count._all ?? 0;
  const helpfulNo = ratings.find((r) => r.helpful === false)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Inteligencia artificial</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Uso, coste, versiones de prompt y respuestas marcadas por los guardarraíles. El modelo nunca calcula
          indicadores ni accede a la base de datos: recibe del backend únicamente el contexto ya verificado.
        </p>
      </header>

      {!isAIConfigured() && (
        <Callout tone="info" title="Sin credencial de proveedor">
          No hay clave de OpenAI configurada. Todos los análisis los genera el motor educativo determinístico
          local, que aplica exactamente las mismas reglas de conducta y las mismas lecturas de indicadores.
        </Callout>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Análisis totales" value={String(totalCalls)} />
        <Stat label="Coste del mes" value={formatUsd(cost)} hint={cap ? `tope ${formatUsd(cap)}` : 'sin tope'} />
        <Stat label="Marcados" value={String(flagged.length)} hint="Guardarraíles activados" />
        <Stat
          label="Valoración"
          value={helpfulYes + helpfulNo > 0 ? `${Math.round((helpfulYes / (helpfulYes + helpfulNo)) * 100)} %` : '—'}
          hint={`${helpfulYes} útiles / ${helpfulNo} no útiles`}
        />
      </div>

      {cap > 0 && (
        <Card className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[14px] font-semibold">Consumo frente al tope mensual</h2>
            <span className="num text-[13px] text-[var(--color-muted)]">
              {formatUsd(cost)} / {formatUsd(cap)}
            </span>
          </div>
          <Progress className="mt-3" value={cost} max={cap} tone={cost >= cap * 0.8 ? 'gold' : 'blue'} label="Consumo de IA" />
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-muted)]">
            Al alcanzar el tope, los análisis pasan automáticamente al motor determinístico local. La
            funcionalidad no se interrumpe y el usuario ve indicado qué motor generó su análisis.
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Uso por tipo de análisis</h2>
          <ul className="mt-3 space-y-1.5">
            {byKind.map((k) => (
              <li key={k.kind} className="flex justify-between text-[13px]">
                <span className="text-[var(--color-muted)]">{k.kind}</span>
                <span className="num">
                  {k._count._all} · {formatUsd(k._sum.costUsd ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Motores utilizados</h2>
          <ul className="mt-3 space-y-1.5">
            {byEngine.map((e) => (
              <li key={e.engine} className="flex justify-between text-[13px]">
                <span className="num text-[var(--color-muted)]">{e.engine}</span>
                <span className="num">{e._count._all}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Mayor uso este mes</h2>
        <ul className="mt-3 space-y-1.5">
          {topUsers.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{u.user.email}</span>
              <span className="num">{u.calls} llamadas</span>
              <span className="num text-[var(--color-subtle)]">{formatUsd(u.costUsd)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Respuestas marcadas por los guardarraíles</h2>
        </div>
        {flagged.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-[var(--color-muted)]">
            Ninguna respuesta ha sido marcada.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {flagged.map((f) => {
              const report = fromJson<GuardrailReport & { degradedReason?: string }>(f.guardrailReport, {
                passed: false,
                violations: [],
              });
              return (
                <li key={f.id} className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="negative">{f.kind}</Badge>
                    <span className="num text-[12px]">{f.symbol ?? '—'}</span>
                    <span className="num text-[11px] text-[var(--color-subtle)]">{f.engine}</span>
                    <span className="ml-auto text-[11px] text-[var(--color-subtle)]">
                      {formatDateTime(f.createdAt, auth.user.timezone)}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {report.violations.map((v, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-[var(--color-muted)]">
                        · <span className="font-medium">{v.rule}</span> ({v.severity}): {v.detail}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Versiones de prompt</h2>
        <ul className="mt-3 space-y-2">
          {Object.values(PROMPT_VERSIONS).map((p) => (
            <li key={p.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num text-[13px] font-medium">{p.id}</span>
                <span className="num text-[11px] text-[var(--color-subtle)]">{p.createdAt}</span>
              </div>
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">{p.notes}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
          Cada análisis guarda el identificador de la versión utilizada, de modo que una auditoría puede
          reconstruir con qué instrucciones se generó una respuesta concreta.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Conductas prohibidas aplicadas</h2>
        <ul className="mt-3 space-y-1.5">
          {AI_PROHIBITED_BEHAVIORS.map((b) => (
            <li key={b} className="text-[12px] leading-relaxed text-[var(--color-muted)]">
              · {b}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{hint}</p>}
    </Card>
  );
}
