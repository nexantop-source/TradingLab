'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { Button, Callout, Field, Input } from '@tl/ui';

/**
 * Alta de la prueba gratuita con tarjeta.
 *
 * El número de tarjeta y el código de seguridad se envían **directamente a
 * Wompi** desde este componente, con la llave pública, y lo único que llega a
 * nuestro servidor es un token de un solo uso. Esa frontera es la que mantiene
 * la instalación fuera del alcance completo de PCI-DSS, así que ningún campo de
 * esta pantalla puede acabar en un `POST` a nuestra API, en un registro ni en
 * la analítica.
 *
 * El importe y el texto del mandato llegan del servidor ya calculados: un
 * precio que viene del navegador no es un precio, es una sugerencia.
 */

interface TrialOffer {
  eligible: true;
  trialDays: number;
  firstChargeAt: string;
  amountInCents: number;
  usdCents: number;
  pricingMode: 'fixed_cop' | 'usd_trm';
  consentVersion: string;
  consentText: string;
  publicKey: string;
  tokenizationUrl: string;
  environment: 'sandbox' | 'production';
  acceptanceToken: string;
  acceptanceUrl: string;
  personalDataToken: string;
  personalDataUrl: string;
}

interface Ineligible {
  eligible: false;
  reason: string;
  detail: string | null;
}

const digits = (value: string) => value.replace(/\D/g, '');

/** Luhn. Evita un viaje a Wompi por una errata evidente. */
function luhnValid(number: string): boolean {
  if (number.length < 13 || number.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function TrialStart({
  planId,
  planName,
  interval,
}: {
  planId: 'STANDARD' | 'PREMIUM';
  planName: string;
  interval: 'MONTHLY' | 'YEARLY';
}) {
  const router = useRouter();
  const ids = {
    number: useId(),
    holder: useId(),
    exp: useId(),
    cvc: useId(),
    accept: useId(),
  };

  const [offer, setOffer] = useState<TrialOffer | Ineligible | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState('');
  const [exp, setExp] = useState('');
  const [cvc, setCvc] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/billing/trial?plan=${planId}&interval=${interval}`, {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setLoadError(result?.error?.message ?? 'No pudimos preparar la prueba gratuita.');
        return;
      }
      setOffer(result.data);
    } catch {
      setLoadError('No pudimos contactar con el servidor.');
    }
  }, [planId, interval]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!offer?.eligible || submitting) return;

    const pan = digits(number);
    const [expMonth, expYear] = exp.split('/').map((part) => digits(part));

    if (!luhnValid(pan)) return setError('Revisa el número de la tarjeta.');
    if (!expMonth || !expYear || Number(expMonth) < 1 || Number(expMonth) > 12) {
      return setError('La fecha de vencimiento no es válida. Usa MM/AA.');
    }
    if (digits(cvc).length < 3) return setError('El código de seguridad no es válido.');
    // Wompi exige al menos cinco caracteres; sin esta comprobación el fallo
    // llega como un rechazo genérico de tarjeta y despista.
    if (holder.trim().length < 5) {
      return setError('Escribe el nombre completo tal como aparece en la tarjeta.');
    }
    if (!accepted) return setError('Necesitamos tu autorización explícita para el cobro posterior.');

    setSubmitting(true);
    setError(null);

    try {
      // ── Frontera PCI: esto va a Wompi, no a TradingLab. ──────────────────
      const tokenResponse = await fetch(offer.tokenizationUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${offer.publicKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: pan,
          cvc: digits(cvc),
          exp_month: expMonth.padStart(2, '0'),
          exp_year: expYear.slice(-2),
          card_holder: holder.trim().toUpperCase(),
        }),
      });
      const tokenResult = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || tokenResult?.status !== 'CREATED') {
        setError('Wompi no aceptó la tarjeta. Revisa los datos o prueba con otra.');
        return;
      }

      // A partir de aquí solo viaja el token de un solo uso.
      const response = await fetch('/api/billing/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          planId,
          interval,
          cardToken: tokenResult.data.id,
          acceptanceToken: offer.acceptanceToken,
          personalDataToken: offer.personalDataToken,
          expMonth: expMonth.padStart(2, '0'),
          expYear: expYear.slice(-2),
          acceptMandate: true,
          consentVersion: offer.consentVersion,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result?.error?.message ?? 'No pudimos iniciar la prueba.');
        return;
      }

      // Los datos de la tarjeta se descartan en cuanto dejan de hacer falta.
      setNumber('');
      setCvc('');
      setExp('');
      router.push('/billing');
      router.refresh();
    } catch {
      setError('No pudimos completar la operación. No se ha realizado ningún cobro.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <Callout tone="danger" title="Prueba no disponible">{loadError}</Callout>;
  if (!offer) return <p className="text-[length:var(--text-xs)] text-[var(--color-muted)]">Preparando…</p>;

  if (!offer.eligible) {
    return (
      <Callout tone="info" title="Esta cuenta no puede iniciar una prueba">
        {offer.detail ?? 'Ya has usado tu prueba gratuita.'}{' '}
        <a href="/precios">Ver los planes →</a>
      </Callout>
    );
  }

  const firstCharge = new Date(offer.firstChargeAt).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {offer.environment === 'sandbox' && (
        <Callout tone="warning" title="Entorno de pruebas">
          Estás en el sandbox de Wompi. No se mueve dinero real y solo funcionan sus tarjetas de prueba.
        </Callout>
      )}

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
        <p className="text-[length:var(--text-md)] font-semibold">
          {offer.trialDays} días gratis de {planName}
        </p>
        <p className="mt-1 text-[length:var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
          Hoy no se te cobra nada. El <strong>{firstCharge}</strong> se cobrarán{' '}
          <strong>USD {(offer.usdCents / 100).toFixed(2)}</strong>
          {offer.pricingMode === 'usd_trm'
            ? ', convertidos a pesos con la TRM vigente ese día'
            : ` (aproximadamente COP ${(offer.amountInCents / 100).toLocaleString('es-CO')})`}
          , y la suscripción seguirá de forma {interval === 'YEARLY' ? 'anual' : 'mensual'}. Puedes cancelar antes desde
          Facturación y no se te cobrará nada.
        </p>
      </div>

      <Field label="Número de tarjeta" htmlFor={ids.number} required>
        <Input
          id={ids.number}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={number}
          maxLength={23}
          onChange={(event) =>
            setNumber(
              digits(event.target.value)
                .slice(0, 19)
                .replace(/(.{4})/g, '$1 ')
                .trim(),
            )
          }
        />
      </Field>

      <Field label="Nombre en la tarjeta" htmlFor={ids.holder} required>
        <Input
          id={ids.holder}
          autoComplete="cc-name"
          placeholder="COMO APARECE EN LA TARJETA"
          value={holder}
          maxLength={60}
          onChange={(event) => setHolder(event.target.value)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vencimiento" htmlFor={ids.exp} required hint="MM/AA">
          <Input
            id={ids.exp}
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="12/34"
            value={exp}
            maxLength={5}
            onChange={(event) => {
              const raw = digits(event.target.value).slice(0, 4);
              setExp(raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw);
            }}
          />
        </Field>
        <Field label="Código de seguridad" htmlFor={ids.cvc} required>
          <Input
            id={ids.cvc}
            inputMode="numeric"
            autoComplete="cc-csc"
            placeholder="123"
            value={cvc}
            maxLength={4}
            onChange={(event) => setCvc(digits(event.target.value).slice(0, 4))}
          />
        </Field>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4">
        <label htmlFor={ids.accept} className="flex cursor-pointer items-start gap-2.5">
          <input
            id={ids.accept}
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[var(--color-blue)]"
          />
          <span className="text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-muted)]">
            {offer.consentText}
          </span>
        </label>
        <p className="mt-2.5 text-[length:var(--text-2xs)] text-[var(--color-subtle)]">
          También acepto los{' '}
          <a href={offer.acceptanceUrl} target="_blank" rel="noopener noreferrer">
            términos de Wompi
          </a>{' '}
          y la{' '}
          <a href={offer.personalDataUrl} target="_blank" rel="noopener noreferrer">
            autorización de tratamiento de datos personales
          </a>
          .
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[length:var(--text-xs)] text-[var(--color-negative)]">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!accepted}>
        <CreditCard size={17} aria-hidden="true" />
        Empezar los {offer.trialDays} días gratis
      </Button>

      <p className="flex items-start gap-1.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        Tu tarjeta viaja cifrada directamente a Wompi. TradingLab nunca recibe ni guarda su número ni su código de
        seguridad: solo los cuatro últimos dígitos para que puedas reconocerla.
      </p>
      <p className="flex items-start gap-1.5 text-[length:var(--text-2xs)] leading-relaxed text-[var(--color-subtle)]">
        <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
        TradingLab es una plataforma educativa y de simulación. El pago da acceso a contenido y práctica con dinero
        virtual, nunca a la gestión de dinero real.
      </p>
    </form>
  );
}
