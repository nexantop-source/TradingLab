'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Button, Callout, Card, Checkbox, Field, Modal, Select, Tabs, cn } from '@tl/ui';
import { VirtualBalance } from '@tl/ui/compliance';
import { THEME_OPTIONS, useTheme } from '@tl/ui/ThemeProvider';
import type { SessionUser, ThemeId } from '@tl/types';
import { ASSET_CLASS_LABEL } from '@tl/types';
import { apiFetch, ApiRequestError, idempotencyKey } from '@/lib/client-api';
import { formatDateTime, formatUsd } from '@/lib/format';

export function ProfileView({
  user,
  profile,
  subscription,
  balanceCents,
  resetsUsed,
  resetsAllowed,
  planFeatures,
  sessions,
  payments,
  certificates,
}: {
  user: SessionUser;
  profile: {
    theme: string;
    reduceMotion: boolean;
    highContrast: boolean;
    emailOptIn: boolean;
    experienceLevel: string;
    marketInterests: string[];
    educationalGoal: string | null;
    riskKnowledgeScore: number;
  };
  subscription: {
    planId: string;
    planName: string;
    status: string;
    interval: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    trialEndsAt: string | null;
  } | null;
  balanceCents: number;
  resetsUsed: number;
  resetsAllowed: number;
  planFeatures: {
    name: string;
    exportCsv: boolean;
    exportPdf: boolean;
    certificates: string;
    priceMonthlyUsd: number;
    priceYearlyUsd: number;
    yearlyDiscount: number;
  };
  sessions: Array<{ id: string; userAgent: string | null; createdAt: string; current: boolean }>;
  payments: Array<{ id: string; amountCents: number; description: string; status: string; createdAt: string }>;
  certificates: Array<{ id: string; trackTitle: string; verificationCode: string; verified: boolean; issuedAt: string }>;
}) {
  const router = useRouter();
  const { theme, setTheme, reduceMotion, setReduceMotion } = useTheme();
  const [tab, setTab] = React.useState<'cuenta' | 'suscripcion' | 'accesibilidad' | 'privacidad'>('cuenta');
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function resetBalance() {
    setBusy(true);
    try {
      const result = await apiFetch<{ message: string; resetsUsed: number }>('/api/demo/reset', {
        method: 'POST',
      });
      setMessage({ tone: 'ok', text: result.message });
      setConfirmReset(false);
      router.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se ha podido reiniciar el saldo.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    setBusy(true);
    try {
      const result = await apiFetch<{ message: string }>('/api/billing/cancel', {
        method: 'POST',
        json: { atPeriodEnd: true },
      });
      setMessage({ tone: 'ok', text: result.message });
      setConfirmCancel(false);
      router.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se ha podido cancelar la suscripción.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function subscribe(planId: 'STANDARD' | 'PREMIUM', interval: 'MONTHLY' | 'YEARLY') {
    setBusy(true);
    try {
      await apiFetch('/api/billing/subscribe', {
        method: 'POST',
        json: { planId, interval, idempotencyKey: idempotencyKey() },
      });
      setMessage({ tone: 'ok', text: `Tu plan ${planId} está activo.` });
      router.refresh();
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiRequestError ? err.message : 'No se ha podido activar el plan.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Perfil y ajustes</h1>
        <p className="mt-1 text-[13px] text-[var(--color-muted)]">
          {user.name} · {user.email}
        </p>
      </header>

      {message && (
        <Callout tone={message.tone === 'ok' ? 'success' : 'danger'}>{message.text}</Callout>
      )}

      <Tabs
        ariaLabel="Secciones del perfil"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'cuenta', label: 'Cuenta' },
          { id: 'suscripcion', label: 'Suscripción' },
          { id: 'accesibilidad', label: 'Apariencia y accesibilidad' },
          { id: 'privacidad', label: 'Privacidad y seguridad' },
        ]}
      />

      {/* ── Cuenta ───────────────────────────────────────────────────────── */}
      {tab === 'cuenta' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Cuenta DEMO</h2>
            <div className="mt-3">
              <VirtualBalance cents={balanceCents} size="lg" />
            </div>
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <p className="text-[13px] text-[var(--color-muted)]">
                Reinicios usados este mes:{' '}
                <span className="num text-[var(--color-text)]">
                  {resetsUsed} de {resetsAllowed}
                </span>
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--color-subtle)]">
                Reiniciar el saldo no borra tu historial ni tu diario: se registra como un asiento más en el libro
                mayor de tu cuenta, con su motivo y su marca temporal.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="secondary"
                disabled={resetsUsed >= resetsAllowed}
                onClick={() => setConfirmReset(true)}
              >
                Reiniciar saldo virtual
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Tu perfil educativo</h2>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row label="Nivel declarado" value={profile.experienceLevel} />
              <Row
                label="Mercados de interés"
                value={
                  profile.marketInterests.length
                    ? profile.marketInterests.map((m) => ASSET_CLASS_LABEL[m as keyof typeof ASSET_CLASS_LABEL] ?? m).join(', ')
                    : 'Sin definir'
                }
              />
              <Row label="Objetivo educativo" value={profile.educationalGoal ?? 'Sin definir'} />
              <Row label="Puntuación de la evaluación inicial" value={`${profile.riskKnowledgeScore} puntos`} />
              <Row label="Zona horaria" value={user.timezone} />
            </dl>
          </Card>

          {certificates.length > 0 && (
            <Card className="p-5">
              <h2 className="text-[14px] font-semibold">Certificados</h2>
              <ul className="mt-3 space-y-2">
                {certificates.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                    <span className="flex-1 text-[13px] font-medium">{c.trackTitle}</span>
                    {c.verified && <Badge tone="positive">Verificable</Badge>}
                    <span className="num text-[11px] text-[var(--color-subtle)]">{c.verificationCode}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
                Los certificados acreditan la finalización de un itinerario formativo dentro de TradingLab. No
                constituyen una titulación oficial ni una habilitación profesional.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* ── Suscripción ──────────────────────────────────────────────────── */}
      {tab === 'suscripcion' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold">Plan {planFeatures.name}</h2>
                {subscription ? (
                  <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                    {subscription.status === 'TRIALING' ? 'En periodo de prueba' : 'Activo'} ·{' '}
                    {subscription.interval === 'YEARLY' ? 'facturación anual' : 'facturación mensual'} · renueva el{' '}
                    {formatDateTime(subscription.currentPeriodEnd, user.timezone)}
                  </p>
                ) : (
                  <p className="mt-1 text-[13px] text-[var(--color-muted)]">
                    Plan gratuito. Sin fecha de renovación ni cargos.
                  </p>
                )}
              </div>
              <Badge tone={user.plan === 'PREMIUM' ? 'violet' : user.plan === 'STANDARD' ? 'blue' : 'neutral'}>
                {user.plan}
              </Badge>
            </div>

            {subscription?.cancelAtPeriodEnd && (
              <Callout tone="warning" className="mt-4" title="Cancelación programada">
                Tu suscripción no se renovará. Conservas el acceso hasta el{' '}
                {formatDateTime(subscription.currentPeriodEnd, user.timezone)}.
              </Callout>
            )}

            {subscription && !subscription.cancelAtPeriodEnd && (
              <Button className="mt-4" size="sm" variant="secondary" onClick={() => setConfirmCancel(true)}>
                Cancelar suscripción
              </Button>
            )}
          </Card>

          {user.plan !== 'PREMIUM' && (
            <Card className="p-5">
              <h2 className="text-[14px] font-semibold">Mejorar de plan</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-muted)]">
                La suscripción da acceso a contenido educativo y a herramientas de simulación. No otorga acceso a
                mercados reales, no constituye una inversión y no genera rendimiento alguno.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(['STANDARD', 'PREMIUM'] as const)
                  .filter((p) => p !== user.plan)
                  .map((p) => (
                    <div key={p} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                      <p className="text-[14px] font-semibold">{p === 'STANDARD' ? 'Standard' : 'Premium'}</p>
                      <p className="num mt-1 text-[13px] text-[var(--color-muted)]">
                        USD {p === 'STANDARD' ? '14,99' : '29,99'} al mes
                      </p>
                      <div className="mt-3 space-y-2">
                        <Button size="sm" fullWidth loading={busy} onClick={() => subscribe(p, 'MONTHLY')}>
                          Activar mensual
                        </Button>
                        <Button
                          size="sm"
                          fullWidth
                          variant="secondary"
                          loading={busy}
                          onClick={() => subscribe(p, 'YEARLY')}
                        >
                          Activar anual
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
              <p className="mt-3 text-[11px] text-[var(--color-subtle)]">
                En este entorno la pasarela funciona en modo de demostración: no se realiza ningún cargo real.{' '}
                <Link href="/precios" className="underline">
                  Ver comparación completa
                </Link>
              </p>
            </Card>
          )}

          {payments.length > 0 && (
            <Card>
              <div className="border-b border-[var(--color-border)] px-5 py-3.5">
                <h2 className="text-[14px] font-semibold">Historial de facturación</h2>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px]">{p.description}</span>
                      <span className="block text-[11px] text-[var(--color-subtle)]">
                        {formatDateTime(p.createdAt, user.timezone)}
                      </span>
                    </span>
                    <span className="num text-[13px]">{formatUsd(p.amountCents / 100)}</span>
                    <Badge tone={p.status === 'SUCCEEDED' ? 'positive' : 'gold'}>{p.status}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {/* ── Accesibilidad ────────────────────────────────────────────────── */}
      {tab === 'accesibilidad' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Tema visual</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={theme === t.id}
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={cn(
                    'rounded-[var(--radius-md)] border p-3.5 text-left transition-colors',
                    theme === t.id
                      ? 'border-[var(--color-blue)] bg-[var(--color-blue-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  <span className="block text-[13px] font-medium">{t.label}</span>
                  <span className="mt-1 block text-[11px] leading-snug text-[var(--color-muted)]">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Movimiento y animaciones</h2>
            <div className="mt-3">
              <Checkbox
                checked={reduceMotion}
                onChange={(e) => setReduceMotion(e.target.checked)}
                label="Reducir animaciones"
                description="Desactiva transiciones y desplazamientos suaves en toda la plataforma. También se activa automáticamente si tu sistema operativo lo indica."
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Compromiso de accesibilidad</h2>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-[var(--color-muted)]">
              {[
                'Navegación completa con teclado y foco siempre visible.',
                'Los gráficos incluyen descripción textual y tabla de valores para lectores de pantalla.',
                'La dirección del precio no se comunica solo con color: usamos también forma, flecha y texto.',
                'Contraste conforme a WCAG AA en los tres temas, con un modo de alto contraste adicional.',
                'Los errores de formulario se describen con texto, no solo con color.',
              ].map((t) => (
                <li key={t}>· {t}</li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ── Privacidad ───────────────────────────────────────────────────── */}
      {tab === 'privacidad' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Sesiones activas</h2>
            <p className="mt-1 text-[12px] text-[var(--color-muted)]">
              Si no reconoces alguna, cierra todas las sesiones y cambia tu contraseña.
            </p>
            <ul className="mt-3 space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3"
                >
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--color-muted)]">
                    {s.userAgent ?? 'Dispositivo desconocido'}
                  </span>
                  <span className="text-[11px] text-[var(--color-subtle)]">
                    {formatDateTime(s.createdAt, user.timezone)}
                  </span>
                  {s.current && <Badge tone="blue">Sesión actual</Badge>}
                </li>
              ))}
            </ul>
            <Button
              className="mt-3"
              size="sm"
              variant="secondary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await apiFetch('/api/me/sessions', { method: 'DELETE' }).catch(() => null);
                setBusy(false);
                router.refresh();
                setMessage({ tone: 'ok', text: 'Se han cerrado las demás sesiones.' });
              }}
            >
              Cerrar el resto de sesiones
            </Button>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Comunicaciones</h2>
            <div className="mt-3">
              <Checkbox
                defaultChecked={profile.emailOptIn}
                onChange={async (e) => {
                  await apiFetch('/api/me/preferences', {
                    method: 'PATCH',
                    json: { emailOptIn: e.target.checked },
                  }).catch(() => null);
                }}
                label="Recibir contenido educativo por correo"
                description="Puedes cambiar esta preferencia en cualquier momento. No compartimos tu correo con anunciantes."
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[14px] font-semibold">Tus datos</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-muted)]">
              Puedes exportar toda tu información o solicitar la eliminación de tu cuenta. La eliminación borra o
              anonimiza tus datos personales en un plazo máximo de treinta días, salvo los que debamos conservar
              por obligación legal.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/me/export" download>
                <Button size="sm" variant="secondary">
                  Exportar mis datos
                </Button>
              </a>
              <Link href="/ayuda?tema=eliminar-cuenta">
                <Button size="sm" variant="ghost">
                  Solicitar la eliminación de mi cuenta
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-subtle)]">
              Consulta la{' '}
              <Link href="/legal/privacidad" className="underline">
                política de privacidad
              </Link>{' '}
              para conocer qué datos tratamos y durante cuánto tiempo.
            </p>
          </Card>
        </div>
      )}

      {/* ── Diálogos ─────────────────────────────────────────────────────── */}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reiniciar el saldo virtual"
        description="Tu saldo volverá a USD 10.000 virtuales."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <Button loading={busy} onClick={resetBalance}>
              Reiniciar saldo
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">
          Tu historial de simulaciones, tu diario y tus estadísticas se conservan intactos. El reinicio queda
          registrado en el libro mayor de tu cuenta como un asiento auditable, con su motivo y su marca temporal.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-muted)]">
          Antes de reiniciar, conviene revisar por qué se agotó el saldo: normalmente hay un patrón de tamaño de
          posición detrás.
        </p>
      </Modal>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancelar tu suscripción"
        description="La cancelación es inmediata y no requiere contactar con soporte."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Mantener mi plan
            </Button>
            <Button variant="negative" loading={busy} onClick={cancelSubscription}>
              Confirmar cancelación
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-[var(--color-muted)]">
          Conservarás el acceso a las funciones de tu plan hasta el final del periodo que ya has abonado. No se
          realizará ningún cargo adicional y no perderás tu historial educativo, tu diario ni tus certificados.
        </p>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="text-right text-[var(--color-text)]">{value}</dd>
    </div>
  );
}
