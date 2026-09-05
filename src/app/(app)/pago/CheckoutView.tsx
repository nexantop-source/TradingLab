'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import { Badge, Button, Callout, Card } from '@tl/ui';
import { apiFetch, ApiRequestError } from '@/lib/client-api';
import type { CheckoutIntent } from '@/lib/checkout-intent';
import { safeWompiCheckoutUrl } from '@/lib/checkout-url';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { PAYMENT_REGION_NOTICE, PAYMENT_REFERENCE_NOTICE } from '@/lib/payment-copy';

interface PreparedCheckout {
  status: 'ACTIVE' | 'TRIALING' | 'REDIRECT';
  provider?: 'wompi';
  paymentId?: string;
  reference?: string;
  expiresAt?: string;
  environment?: 'sandbox' | 'production';
  redirectUrl?: string;
  subscriptionId: string;
  currentPeriodEnd: string;
  amountInCents?: number;
  currency?: 'COP' | 'USD';
  notice?: string;
}

export function CheckoutView({
  intent,
  plan,
  existingSubscription,
}: {
  intent: CheckoutIntent;
  plan: { name: string; tagline: string; referencePriceUsd: number; highlights: string[] };
  existingSubscription: {
    planId: string;
    status: string;
    interval: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  } | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [prepared, setPrepared] = React.useState<PreparedCheckout | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [copyMessage, setCopyMessage] = React.useState('');
  const hasActivePaidPeriod = existingSubscription != null;

  function idempotencyKey() {
    const storageKey = `tl-checkout:${intent.plan}:${intent.interval}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const next = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${crypto.getRandomValues(new Uint32Array(4)).join('-')}`;
    window.sessionStorage.setItem(storageKey, next);
    return next;
  }

  async function prepareCheckout() {
    setLoading(true);
    setError(null);
    setCopyMessage('');
    try {
      const result = await apiFetch<PreparedCheckout>('/api/billing/subscribe', {
        method: 'POST',
        json: {
          planId: intent.plan,
          interval: intent.interval,
          idempotencyKey: idempotencyKey(),
        },
      });
      setPrepared(result);
      if (result.status !== 'REDIRECT') {
        window.sessionStorage.removeItem(`tl-checkout:${intent.plan}:${intent.interval}`);
      }
    } catch (err) {
      if (
        err instanceof ApiRequestError &&
        ['PAYMENT_CHECKOUT_EXPIRED', 'PAYMENT_REFERENCE_USED'].includes(err.code)
      ) {
        window.sessionStorage.removeItem(`tl-checkout:${intent.plan}:${intent.interval}`);
      }
      setError(err instanceof ApiRequestError ? err.message : 'No pudimos preparar el pago. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function openWompi() {
    if (!prepared?.redirectUrl) return;
    try {
      window.location.assign(safeWompiCheckoutUrl(prepared.redirectUrl));
    } catch {
      setError('El destino de pago no superó la validación de seguridad. No se abrió ninguna página.');
    }
  }

  async function copyPaymentLink() {
    if (!prepared?.redirectUrl) return;
    try {
      await navigator.clipboard.writeText(safeWompiCheckoutUrl(prepared.redirectUrl));
      setCopyMessage('Enlace copiado. Este pago permanece vinculado a tu cuenta.');
    } catch {
      setCopyMessage('No se pudo copiar automáticamente. Selecciona y copia el enlace del campo.');
    }
  }

  if (hasActivePaidPeriod) {
    const currentPlanName = existingSubscription.planId === 'PREMIUM' ? PLAN_ENTITLEMENTS.PREMIUM.name : PLAN_ENTITLEMENTS.STANDARD.name;
    return (
      <div className="app-content-page mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Card className="p-7">
          <Badge tone="positive">Plan activo</Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">Ya tienes un periodo activo.</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">
            Tu acceso {currentPlanName} continúa hasta el{' '}
            {new Date(existingSubscription.currentPeriodEnd).toLocaleDateString('es-CO')}. Para evitar un doble
            cobro, no abrimos otro checkout mientras ese periodo esté vigente.
          </p>
          <Link href="/perfil" className="mt-6 inline-block">
            <Button>Gestionar mi suscripción</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-content-page mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
      <Link href="/precios" className="inline-flex items-center gap-2 text-[12px] font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Volver a planes
      </Link>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-blue-soft)] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="blue">{intent.interval === 'YEARLY' ? 'Facturación anual' : 'Facturación mensual'}</Badge>
              <span className="num text-[11px] text-[var(--color-subtle)]">PAGO EDUCATIVO · NO DEPÓSITO</span>
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em]">Plan {plan.name}</h1>
            <p className="mt-2 text-[14px] text-[var(--color-muted)]">{plan.tagline}</p>
            <div className="mt-6">
              <p className="num text-3xl font-semibold tracking-[-0.04em]">
                USD {plan.referencePriceUsd.toFixed(2)}
              </p>
              <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
                {PAYMENT_REFERENCE_NOTICE}
              </p>
            </div>
          </div>
          <div className="p-6 sm:p-8">
            <h2 className="text-[13px] font-semibold">Incluido desde la activación</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {plan.highlights.map((item) => (
                <li key={item} className="flex gap-2.5 text-[12px] leading-snug text-[var(--color-muted)]">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <div className="space-y-4">
          <Callout tone="info" title="Colombia · Pagos en COP">{PAYMENT_REGION_NOTICE}</Callout>
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-positive-soft)] text-[var(--color-positive)]">
                <LockKeyhole className="size-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[14px] font-semibold">Checkout protegido por Wompi</h2>
                <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-muted)]">
                  TradingLab no recibe ni almacena el número de tu tarjeta. La membresía se activa solo después de que el servidor valide la firma y confirme la transacción directamente con Wompi.
                </p>
              </div>
            </div>

            {error && <Callout tone="danger" className="mt-5" title="Pago no preparado">{error}</Callout>}

            {prepared?.status === 'REDIRECT' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">Importe firmado por el servidor</p>
                  <p className="num mt-2 text-2xl font-semibold">
                    {prepared.currency === 'COP' && prepared.amountInCents != null
                      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(prepared.amountInCents / 100)
                      : 'Importe disponible en Wompi'}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">Verifica este mismo importe en la pantalla de Wompi antes de autorizar.</p>
                </div>
                <Button size="lg" fullWidth onClick={openWompi}>
                  Abrir checkout seguro <ExternalLink className="size-4" aria-hidden="true" />
                </Button>
                {prepared.environment === 'sandbox' && <Callout tone="info" title="Pago de prueba">Este enlace pertenece al ambiente Sandbox de Wompi. No es un cobro real.</Callout>}
                <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
                  <p className="text-[12px] font-semibold">Tu pago, vinculado a tu cuenta</p>
                  <dl className="mt-3 space-y-3 text-[11px]">
                    <div><dt className="text-[var(--color-muted)]">Referencia en Wompi</dt><dd className="mt-1 break-all font-mono select-all">{prepared.reference}</dd></div>
                    <div><dt className="text-[var(--color-muted)]">ID de pago en TradingLab</dt><dd className="mt-1 break-all font-mono select-all">{prepared.paymentId}</dd></div>
                    {prepared.expiresAt && <div><dt className="text-[var(--color-muted)]">Enlace válido hasta</dt><dd className="mt-1">{new Date(prepared.expiresAt).toLocaleString('es-CO')}</dd></div>}
                  </dl>
                  <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-muted)]">No tienes que ingresar el ID después de pagar. Aplicaremos el plan a esta cuenta cuando Wompi confirme el pago y el servidor lo valide.</p>
                  <label htmlFor="wompi-payment-link" className="mt-4 block text-[11px] font-medium">Enlace de pago</label>
                  <input id="wompi-payment-link" type="text" readOnly value={prepared.redirectUrl ?? ''} onFocus={event => event.currentTarget.select()} className="mt-2 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[11px]" />
                  <Button className="mt-3" fullWidth onClick={copyPaymentLink}><Copy className="size-4" aria-hidden="true" />Copiar enlace de pago</Button>
                  <p role="status" aria-live="polite" className="mt-2 text-[11px] leading-relaxed text-[var(--color-muted)]">{copyMessage}</p>
                </div>
              </div>
            ) : prepared ? (
              <div className="mt-6">
                <Callout tone="success" title={prepared.provider === 'wompi' ? 'Pago confirmado y plan activado' : 'Plan activado en entorno de prueba'}>
                  {prepared.provider === 'wompi' ? 'Este pago ya fue verificado por el servidor y aplicado a tu cuenta. No necesitas pagarlo otra vez.' : 'La integración de desarrollo confirmó la activación sin abrir una pasarela real.'}
                </Callout>
                <Button className="mt-4" fullWidth onClick={() => { router.push('/perfil'); router.refresh(); }}>
                  Ver mi membresía <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button className="mt-6" size="lg" fullWidth loading={loading} onClick={prepareCheckout}>
                Preparar importe en COP <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            )}

            <p className="mt-4 text-[10px] leading-relaxed text-[var(--color-subtle)]">
              Continuar no deposita dinero para operar. Adquieres acceso temporal a contenido y herramientas de simulación. El retorno del navegador nunca activa una membresía por sí solo.
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-muted)]">Este checkout compra un periodo de acceso. No autoriza renovaciones ni débitos recurrentes automáticos.</p>
          </Card>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <ShieldCheck className="size-4 shrink-0 text-[var(--color-blue)]" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">Referencia única, firma de integridad e idempotencia contra cobros duplicados.</p>
            </div>
            <div className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <LockKeyhole className="size-4 shrink-0 text-[var(--color-blue)]" aria-hidden="true" />
              <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">Webhook firmado y verificación servidor a servidor antes de cambiar tu plan.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
