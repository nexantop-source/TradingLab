import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { parseWompiPaymentDescription } from '@/lib/wompi';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Facturación' };
export default async function BillingPage() {
  const auth = await getAuth();
  if (!auth) redirect('/entrar');
  const [subscription, payments] = await Promise.all([
    db.subscription.findUnique({ where: { userId: auth.user.id } }),
    db.payment.findMany({ where: { userId: auth.user.id }, orderBy: { createdAt: 'desc' }, take: 50,
      select: { id: true, amountCents: true, currency: true, status: true, description: true, createdAt: true } }),
  ]);
  const names: Record<string,string> = { SUCCEEDED:'Pagado', PENDING:'Pendiente de confirmación', FAILED:'No aprobado', REFUNDED:'Reembolsado', SUPERSEDED:'Enlace sustituido', REVIEW_REQUIRED:'En revisión' };
  return <div className="billing-page"><h1>Facturación</h1><p>Tu plan, tus pagos y la información que necesitas. Todo en un lugar.</p>
    <section><h2>{PLAN_ENTITLEMENTS[auth.user.plan].name} {auth.user.plan === 'FREE' ? 'incluido' : 'activo'}</h2><p>{auth.user.plan === 'FREE' ? 'Tu cuenta gratuita permanece disponible sin tarjeta.' : `Acceso hasta ${subscription?.currentPeriodEnd.toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }) ?? 'la fecha de tu suscripción'}.`}</p><p>Los pagos actuales compran un periodo de acceso. No hay renovación ni débitos automáticos.</p><Link href="/precios">Ver planes y beneficios →</Link><br /><Link href="/perfil">Gestionar mi suscripción →</Link></section>
    <section><h2>Método de pago</h2><p>La tarjeta se introduce y procesa en Wompi. TradingLab no almacena su número ni su código de seguridad.</p><p>No tienes una tarjeta registrada para cobros recurrentes en TradingLab. La prueba con tarjeta y cobro al día siete todavía no está habilitada.</p></section>
    <section><h2>Historial de pagos</h2>{payments.length ? <ul>{payments.map(payment => {
      let label = 'Membresía TradingLab';
      try { const info = parseWompiPaymentDescription(payment.description); label = `Plan ${PLAN_ENTITLEMENTS[info.planId].name}`; } catch { /* Do not expose internal metadata. */ }
      return <li key={payment.id}><div><b>{label}</b><small>{payment.createdAt.toLocaleDateString('es-CO', { timeZone:'America/Bogota' })} · {names[payment.status] ?? 'En revisión'}</small><small>ID: {payment.id}</small></div><strong>{payment.currency} {(payment.amountCents / 100).toLocaleString('es-CO', { minimumFractionDigits:2 })}</strong></li>;
    })}</ul> : <p>Aún no tienes pagos registrados. Los importes aparecerán aquí cuando inicies un checkout.</p>}<p>El estado «Pagado» solo aparece después de la validación del servidor. Este historial no sustituye una factura fiscal.</p></section></div>;
}
