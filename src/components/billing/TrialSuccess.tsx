'use client';

import Link from 'next/link';
import { BadgeCheck, CalendarClock, CreditCard, GraduationCap } from 'lucide-react';
import { Button } from '@tl/ui';
import { CardBrand } from './CardBrand';

export interface TrialStarted {
  planName: string;
  trialDays: number;
  firstChargeAt: string;
  usdCents: number;
  card: { brand: string | null; lastFour: string | null };
}

/**
 * Confirmación tras iniciar la prueba.
 *
 * Existe porque el momento después de entregar una tarjeta es exactamente
 * cuando alguien necesita saber que no le han cobrado, cuándo le cobrarán y
 * cómo pararlo. Volver en silencio a la aplicación deja esa duda abierta, y la
 * duda es lo que produce las cancelaciones inmediatas y los contracargos.
 *
 * Por eso repite el compromiso en lugar de celebrar: la fecha exacta, el
 * importe exacto y dónde cancelar.
 */
export function TrialSuccess({ started }: { started: TrialStarted }) {
  const charge = new Date(started.firstChargeAt).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="trial-success" role="status" aria-live="polite">
      <span className="trial-success-mark" aria-hidden="true">
        <BadgeCheck size={26} />
      </span>

      <h1>
        Listo. Tienes {started.planName} durante {started.trialDays} días.
      </h1>
      <p className="trial-success-lede">
        No se te ha cobrado nada. Tu tarjeta queda guardada para el primer cobro, y puedes cancelar antes sin coste.
      </p>

      <dl className="trial-success-facts">
        <div>
          <dt>
            <CalendarClock size={14} aria-hidden="true" /> Primer cobro
          </dt>
          <dd>
            <strong>{charge}</strong>
            <span>
              USD <span className="num">{(started.usdCents / 100).toFixed(2)}</span>, convertidos a pesos ese día
            </span>
          </dd>
        </div>
        <div>
          <dt>
            <CreditCard size={14} aria-hidden="true" /> Tarjeta guardada
          </dt>
          <dd>
            <span className="trial-success-card">
              <CardBrand brand={started.card.brand} />
              <strong className="num">
                {started.card.brand ?? 'Tarjeta'} ···· {started.card.lastFour ?? '····'}
              </strong>
            </span>
            <span>Solo guardamos los cuatro últimos dígitos.</span>
          </dd>
        </div>
      </dl>

      <div className="trial-success-actions">
        <Link href="/academia">
          <Button size="lg">
            <GraduationCap size={17} aria-hidden="true" />
            Empezar por la academia
          </Button>
        </Link>
        <Link href="/billing">
          <Button size="lg" variant="outline">
            Ver mi facturación
          </Button>
        </Link>
      </div>

      <p className="trial-success-foot">
        Te avisaremos antes del cobro. Puedes cancelar cuando quieras desde Facturación y conservarás el acceso hasta
        que termine la prueba.
      </p>
    </div>
  );
}
