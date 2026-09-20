import { PricingPlans } from '@/components/investment/PricingPlans';
import { FAQSection } from '@/components/marketing/sections';
import { InvestmentArtwork } from '@/components/investment/InvestmentArtwork';
import { NativePlans } from '@/components/pwa/NativePlans';
import { getAuth } from '@/lib/auth';
export const metadata = { title: 'Planes Explore, Plus y Pro', description: 'Explore gratis, Plus USD 5,99/mes y Pro USD 19,99/mes. Aprende y practica. Pago con Wompi en pesos colombianos.' };
export default async function PricingPage() {
  const auth = await getAuth();
  return <><NativePlans currentPlan={auth?.user.plan ?? null} /><div className="browser-pricing-page visual-pricing-page"><header className="invest-section invest-page-heading centered visual-pricing-header"><div className="visual-pricing-art"><InvestmentArtwork scene="horizon" priority /></div><span className="invest-eyebrow">INVIERTE EN TU CRITERIO</span><h1>Más posibilidades.<br /><span>A tu medida.</span></h1><p>Desde tu primera pregunta hasta tu análisis más profundo.<br />Empieza gratis. Encuentra el espacio que acompaña tu ritmo.</p></header><PricingPlans heading={false} currentPlan={auth?.user.plan ?? null} /><FAQSection /></div></>;
}
