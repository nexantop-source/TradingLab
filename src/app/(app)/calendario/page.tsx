import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { getEconomicEvents, IMPACT_LABEL } from '@tl/market-data';
import { Badge, Card, Callout } from '@tl/ui';
import { AdSlot } from '@/components/AdSlot';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Calendario económico' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const events = getEconomicEvents(Date.now() - 2 * 86400000, Date.now() + 21 * 86400000);

  // Agrupa por día en la zona horaria del usuario.
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const key = new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeZone: auth.user.timezone,
    }).format(new Date(e.time));
    const list = byDay.get(key);
    if (list) list.push(e);
    else byDay.set(key, [e]);
  }

  const now = Date.now();

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Calendario económico</h1>
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-[var(--color-muted)]">
          Horas expresadas en tu zona horaria ({auth.user.timezone}). Lo que mueve el precio no es la cifra
          publicada, sino su diferencia respecto a lo que el mercado esperaba.
        </p>
      </header>

      <Callout tone="warning" title="Antes de una publicación de impacto alto">
        El spread suele ampliarse, la primera reacción se revierte con frecuencia y un stop loss ajustado tiene
        alta probabilidad de activarse por la volatilidad del momento, sin que tu hipótesis haya fallado.{' '}
        <Link href="/academia/leccion/leer-el-calendario-economico" className="underline">
          Ver la lección completa
        </Link>
        .
      </Callout>

      <AdSlot code="calendar-sponsor" page="calendar" />

      <div className="space-y-5">
        {Array.from(byDay.entries()).map(([day, dayEvents]) => (
          <section key={day}>
            <h2 className="text-[13px] font-semibold capitalize text-[var(--color-muted)]">{day}</h2>
            <Card className="mt-2">
              <ul className="divide-y divide-[var(--color-border)]">
                {dayEvents.map((e) => {
                  const past = e.time < now;
                  return (
                    <li key={e.id} className={past ? 'opacity-55' : ''}>
                      <details className="group">
                        <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                          <span className="num w-14 shrink-0 text-[12px] font-medium">
                            {formatDateTime(e.time, auth.user.timezone).split(', ')[1] ??
                              new Date(e.time).toISOString().slice(11, 16)}
                          </span>
                          <Badge tone="neutral">{e.countryCode}</Badge>
                          <span className="min-w-0 flex-1 text-[13px] leading-snug">{e.title}</span>
                          <Badge tone={e.impact === 'HIGH' ? 'negative' : e.impact === 'MEDIUM' ? 'gold' : 'neutral'}>
                            {IMPACT_LABEL[e.impact]}
                          </Badge>
                        </summary>
                        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
                          <p className="text-[12px] leading-relaxed text-[var(--color-muted)]">
                            {e.educationalNote}
                          </p>
                          {e.relatedSymbols.length > 0 && (
                            <p className="num mt-2 text-[11px] text-[var(--color-subtle)]">
                              Instrumentos habitualmente sensibles:{' '}
                              {e.relatedSymbols.map((s, i) => (
                                <span key={s}>
                                  {i > 0 && ' · '}
                                  <Link href={`/terminal?symbol=${s}`} className="hover:text-[var(--color-blue)]">
                                    {s}
                                  </Link>
                                </span>
                              ))}
                            </p>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-subtle)]">
        Calendario educativo generado a partir de la periodicidad habitual de las principales publicaciones
        macroeconómicas. No incluye cifras publicadas ni previsiones de consenso, y no sustituye a un calendario
        con licencia de datos. Las fechas pueden variar respecto al calendario oficial de cada organismo.
      </p>
    </div>
  );
}
