import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreditCard, ShieldCheck, TriangleAlert, CalendarClock } from 'lucide-react';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { parseWompiPaymentDescription } from '@/lib/wompi';
import { billingOverview } from '@/lib/trials';
import { CancelTrial } from './CancelTrial';
import { CardBrand } from '@/components/billing/CardBrand';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Facturación' };

const PAYMENT_STATUS: Record<string, string> = {
  SUCCEEDED: 'Pagado',
  PENDING: 'Pendiente de confirmación',
  FAILED: 'No aprobado',
  REFUNDED: 'Reembolsado',
  SUPERSEDED: 'Enlace sustituido',
  REVIEW_REQUIRED: 'En revisión',
};

function date(value: Date): string {
  return value.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BillingPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');

  const [overview, payments] = await Promise.all([
    billingOverview(auth.user.id),
    db.payment.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, amountCents: true, currency: true, status: true, description: true, createdAt: true },
    }),
  ]);

  const plan = PLAN_ENTITLEMENTS[overview.plan];
  const trialing = overview.trialDaysLeft !== null;
  const cancelled = Boolean(overview.canceledAt) && overview.nextChargeAt === null;

  return (
    <div className="billing-page">
      <h1>Facturación</h1>
      <p>Tu plan, tu método de pago y lo que se te va a cobrar. Sin sorpresas.</p>

      {/* ── Estado de la prueba ──────────────────────────────────────────── */}
      {trialing && (
        <section aria-labelledby="prueba">
          <h2 id="prueba">
            <CalendarClock size={17} aria-hidden="true" />{' '}
            {overview.trialDaysLeft === 1
              ? 'Te queda 1 día de prueba'
              : `Te quedan ${overview.trialDaysLeft} días de prueba`}
          </h2>
          <p>
            Estás usando <strong>{plan.name}</strong> gratis
            {overview.trialEndsAt ? ` hasta el ${date(overview.trialEndsAt)}` : ''}.
          </p>

          {cancelled ? (
            <p>
              <ShieldCheck size={15} aria-hidden="true" /> Cancelaste la renovación:{' '}
              <strong>no se te cobrará nada</strong>. Conservas el acceso hasta que termine la prueba, y después tu
              cuenta vuelve al plan {PLAN_ENTITLEMENTS.FREE.name} sin coste.
            </p>
          ) : (
            <>
              <p>
                <strong>
                  El {overview.nextChargeAt ? date(overview.nextChargeAt) : 'terminar la prueba'} se cobrará
                  {overview.nextChargeAmountUsdCents !== null
                    ? ` USD ${(overview.nextChargeAmountUsdCents / 100).toFixed(2)}`
                    : ''}
                </strong>{' '}
                a la tarjeta que registraste, y la suscripción continuará de forma{' '}
                {overview.interval === 'YEARLY' ? 'anual' : 'mensual'}.
              </p>
              <p>Si cancelas antes de esa fecha no se te cobra nada y mantienes el acceso hasta que termine la prueba.</p>
              <CancelTrial daysLeft={overview.trialDaysLeft ?? 0} />
            </>
          )}
        </section>
      )}

      {/* ── Plan ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="plan">
        <h2 id="plan">
          {plan.name} {overview.plan === 'FREE' ? 'incluido' : trialing ? 'en prueba' : 'activo'}
        </h2>
        {overview.plan === 'FREE' ? (
          <p>Tu cuenta gratuita permanece disponible sin tarjeta.</p>
        ) : (
          <p>
            Acceso hasta {overview.currentPeriodEnd ? date(overview.currentPeriodEnd) : 'la fecha de tu suscripción'}.
          </p>
        )}
        {overview.status === 'PAST_DUE' && (
          <p>
            <TriangleAlert size={15} aria-hidden="true" /> No pudimos cobrar tu último periodo
            {overview.lastChargeError ? `: ${overview.lastChargeError}` : '.'} Actualiza tu tarjeta para recuperar el
            acceso.
          </p>
        )}
        <Link href="/planes">Ver planes y beneficios →</Link>
        <br />
        <Link href="/perfil">Gestionar mi cuenta →</Link>
      </section>

      {/* ── Método de pago ───────────────────────────────────────────────── */}
      <section aria-labelledby="metodo">
        <h2 id="metodo">
          <CreditCard size={17} aria-hidden="true" /> Método de pago
        </h2>
        {overview.card ? (
          <>
            <p className="billing-card-row">
              <CardBrand brand={overview.card.brand} />
              <strong>
                {overview.card.brand ?? 'Tarjeta'} ···· {overview.card.lastFour ?? '····'}
              </strong>
              {overview.card.expMonth && overview.card.expYear && (
                <span className="billing-card-exp">vence {overview.card.expMonth}/{overview.card.expYear}</span>
              )}
            </p>
            <p>
              La tarjeta se tokenizó en Wompi desde tu navegador. TradingLab no guarda su número ni su código de
              seguridad: solo el identificador de la tarjeta en Wompi y los cuatro últimos dígitos para que puedas
              reconocerla.
            </p>
          </>
        ) : (
          <p>
            No tienes ninguna tarjeta registrada. La tarjeta se introduce y procesa en Wompi; TradingLab no almacena
            su número ni su código de seguridad.
          </p>
        )}
      </section>

      {/* ── Mandato ──────────────────────────────────────────────────────── */}
      {overview.mandate && (
        <section aria-labelledby="mandato">
          <h2 id="mandato">Autorización de cobro</h2>
          <p>
            Aceptada el {date(overview.mandate.acceptedAt)}
            {overview.mandate.revokedAt ? ` y revocada el ${date(overview.mandate.revokedAt)}` : ''}. Versión{' '}
            <span className="num">{overview.mandate.consentVersion}</span>.
          </p>
          <blockquote>{overview.mandate.consentText}</blockquote>
        </section>
      )}

      {/* ── Historial ────────────────────────────────────────────────────── */}
      <section aria-labelledby="historial">
        <h2 id="historial">Historial de pagos</h2>
        {payments.length ? (
          <ul>
            {payments.map((payment) => {
              let label = 'Membresía TradingLab';
              try {
                const info = parseWompiPaymentDescription(payment.description);
                label = `Plan ${PLAN_ENTITLEMENTS[info.planId].name}`;
              } catch {
                /* No se expone metadato interno alguno. */
              }
              return (
                <li key={payment.id}>
                  <div>
                    <b>{label}</b>
                    <small>
                      {payment.createdAt.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })} ·{' '}
                      {PAYMENT_STATUS[payment.status] ?? 'En revisión'}
                    </small>
                    <small>ID: {payment.id}</small>
                  </div>
                  <strong>
                    {payment.currency}{' '}
                    {(payment.amountCents / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}
                  </strong>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>Aún no tienes pagos registrados. Los importes aparecerán aquí cuando se realice el primer cobro.</p>
        )}
        <p>
          El estado «Pagado» solo aparece después de que el servidor confirme la transacción con Wompi. Este historial
          no sustituye una factura fiscal.
        </p>
      </section>
    </div>
  );
}
