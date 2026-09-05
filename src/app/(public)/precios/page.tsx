import { PricingPlans } from '@/components/investment/PricingPlans';
import { FAQSection } from '@/components/marketing/sections';
import { InvestmentArtwork } from '@/components/investment/InvestmentArtwork';
export const metadata = { title: 'Planes Explore, Plus y Pro', description: 'Explore gratis, Plus USD 14,99/mes y Pro USD 29,99/mes. Herramientas, academia y análisis con precios claros.' };
export default function PricingPage() {
  return <div className="visual-pricing-page"><header className="invest-section invest-page-heading centered visual-pricing-header"><div className="visual-pricing-art"><InvestmentArtwork scene="horizon" priority /></div><span className="invest-eyebrow">INVIERTE EN TU CRITERIO</span><h1>Más posibilidades.<br /><span>A tu medida.</span></h1><p>Desde tu primera pregunta hasta tu análisis más profundo.<br />Empieza gratis. Encuentra el espacio que acompaña tu ritmo.</p></header><PricingPlans heading={false} /><FAQSection /></div>;
}
