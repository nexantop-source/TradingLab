import { PricingPlans } from '@/components/investment/PricingPlans';
import { FAQSection } from '@/components/marketing/sections';
export const metadata = { title: 'Planes Explore, Plus y Pro', description: 'Explore gratis, Plus USD 14,99/mes y Pro USD 29,99/mes. Herramientas, academia y análisis con precios claros.' };
export default function PricingPage() {
  return <><header className="invest-section invest-page-heading centered"><span className="invest-eyebrow">INVIERTE EN TU CRITERIO</span><h1>Más posibilidades.<br /><span>A tu medida.</span></h1><p>Desde tu primera pregunta hasta tu análisis más profundo.<br />Todos los planes incluyen una cuenta con USD 10.000 virtuales.</p></header><PricingPlans heading={false} /><FAQSection /></>;
}
