import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { db } from '@/lib/db';
import { LEGAL_DOCS } from '@/content/legal';
import { FORBIDDEN_CLAIMS, WHAT_WE_DO_NOT_DO } from '@tl/types/compliance';
import { Badge, Card, Callout } from '@tl/ui';
import { formatDateTime } from '@/lib/format';

export const metadata: Metadata = { title: 'Cumplimiento' };
export const dynamic = 'force-dynamic';

export default async function AdminCompliancePage() {
  const auth = await getAuth();
  if (!auth || !can(auth.user.role, 'compliance:read')) redirect('/panel');

  const [documents, consentsByKind, restrictedCountries, flaggedAI, pendingCreatives, recentConsents] =
    await Promise.all([
      db.legalDocument.findMany({ orderBy: [{ slug: 'asc' }, { version: 'desc' }] }),
      db.consent.groupBy({ by: ['kind', 'granted'], _count: { _all: true } }),
      db.restrictedCountry.findMany(),
      db.aIAnalysis.count({ where: { flagged: true } }),
      db.creative.count({ where: { reviewStatus: 'PENDING' } }),
      db.consent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { user: { select: { email: true } }, document: { select: { slug: true, version: true } } },
      }),
    ]);

  const envRestricted = (process.env.RESTRICTED_COUNTRIES ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Cumplimiento</h1>
        <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-muted)]">
          Versiones legales, consentimientos registrados, países restringidos y controles de contenido.
        </p>
      </header>

      <Callout tone="warning" title="Revisión jurídica pendiente">
        Los documentos del centro legal son textos de referencia redactados para que la plataforma sea funcional y
        coherente desde el primer día. Antes de la explotación comercial deben revisarse por asesoría jurídica en
        cada jurisdicción de destino, junto con la información registral de la entidad.
      </Callout>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Documentos vigentes" value={String(documents.length)} />
        <Stat label="Consentimientos registrados" value={String(consentsByKind.reduce((a, c) => a + c._count._all, 0))} />
        <Stat label="Análisis marcados por IA" value={String(flaggedAI)} />
        <Stat label="Creatividades por revisar" value={String(pendingCreatives)} />
      </div>

      <Card className="overflow-x-auto">
        <div className="border-b border-[var(--color-border)] px-5 py-3.5">
          <h2 className="text-[14px] font-semibold">Documentos legales versionados</h2>
        </div>
        <table className="w-full min-w-[36rem] text-[12px]">
          <caption className="sr-only">Documentos legales</caption>
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Documento</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">Versión</th>
              <th scope="col" className="px-4 py-2.5 text-left font-medium">En vigor desde</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Consentimientos</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{d.title}</span>
                  <span className="num block text-[10px] text-[var(--color-subtle)]">{d.slug}</span>
                </td>
                <td className="num px-4 py-2.5">{d.version}</td>
                <td className="px-4 py-2.5 text-[var(--color-muted)]">
                  {formatDateTime(d.effectiveAt, auth.user.timezone)}
                </td>
                <td className="num px-4 py-2.5 text-right text-[var(--color-muted)]">
                  {recentConsents.filter((c) => c.document.slug === d.slug).length || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-[var(--color-border)] px-5 py-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
          Definición de referencia en <span className="num">src/content/legal.ts</span>. Publicar una versión nueva
          exige una nueva aceptación por parte del usuario cuando el cambio es sustancial.
        </p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Consentimientos por tipo</h2>
          <ul className="mt-3 space-y-1.5">
            {consentsByKind.map((c) => (
              <li key={`${c.kind}-${c.granted}`} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="num text-[var(--color-muted)]">{c.kind}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={c.granted ? 'positive' : 'neutral'}>
                    {c.granted ? 'concedido' : 'denegado'}
                  </Badge>
                  <span className="num">{c._count._all}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Países restringidos</h2>
          {restrictedCountries.length === 0 && envRestricted.length === 0 ? (
            <p className="mt-3 text-[12px] leading-relaxed text-[var(--color-muted)]">
              No hay países restringidos configurados. Se definen en la variable de entorno{' '}
              <span className="num">RESTRICTED_COUNTRIES</span> o en la tabla{' '}
              <span className="num">RestrictedCountry</span>. El registro se bloquea en el servidor, no solo en el
              formulario.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {envRestricted.map((c) => (
                <li key={c} className="num text-[12px] text-[var(--color-muted)]">
                  · {c} (variable de entorno)
                </li>
              ))}
              {restrictedCountries.map((c) => (
                <li key={c.code} className="text-[12px] text-[var(--color-muted)]">
                  · <span className="num">{c.code}</span> {c.name} — {c.reason}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold">Consentimientos recientes</h2>
        <ul className="mt-3 space-y-1.5">
          {recentConsents.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="min-w-0 flex-1 truncate text-[var(--color-muted)]">{c.user.email}</span>
              <span className="num text-[10px] text-[var(--color-subtle)]">
                {c.document.slug} v{c.document.version}
              </span>
              <Badge tone={c.granted ? 'positive' : 'neutral'}>{c.kind}</Badge>
              <span className="text-[10px] text-[var(--color-subtle)]">
                {formatDateTime(c.createdAt, auth.user.timezone)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Afirmaciones prohibidas</h2>
          <p className="mt-1.5 text-[12px] text-[var(--color-muted)]">
            Bloqueadas en textos de producto, respuestas de la IA y creatividades publicitarias.
          </p>
          <p className="num mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
            {FORBIDDEN_CLAIMS.join(' · ')}
          </p>
        </Card>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold">Declaración de naturaleza del servicio</h2>
          <ul className="mt-3 space-y-1.5">
            {WHAT_WE_DO_NOT_DO.map((t) => (
              <li key={t} className="text-[12px] leading-relaxed text-[var(--color-muted)]">
                · {t}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-subtle)]">{label}</p>
      <p className="num mt-1.5 text-xl font-semibold tracking-tight">{value}</p>
    </Card>
  );
}
