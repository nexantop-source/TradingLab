import Link from 'next/link';
import { AssetIcon } from '@/components/investment/AssetIcon';
import { InvestmentArtwork } from '@/components/investment/InvestmentArtwork';
import { ArrowRight, ArrowUpRight, Layers3, Globe2, Compass, ShieldCheck, Sparkles, BookOpen, ChevronRight } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { InstallSection } from '@/components/marketing/InstallSection';
import { PricingPlans } from '@/components/investment/PricingPlans';
import { PlatformPreview } from '@/components/investment/PlatformPreview';
import { getAuth } from '@/lib/auth';
import { marketData, SYMBOLS } from '@tl/market-data';
export const dynamic = 'force-dynamic';
export default async function LandingPage() {
  const auth = await getAuth();
  const provider = marketData();
  const symbols = ['SPY', 'BTCUSD', 'EURUSD'];
  const samples = await Promise.all(symbols.map(async symbol => {
    const [quote, series] = await Promise.all([provider.getQuote(symbol), provider.getCandles({ symbol, timeframe: '1h', limit: 90 })]);
    const meta = SYMBOLS.find(s => s.symbol === symbol)!;
    return { symbol, name: meta.name, price: quote.price, change: quote.changePercent, values: series.candles.map(c => c.c), synthetic: provider.synthetic, source: provider.label, precision: meta.precision };
  }));
  const destination = auth ? '/panel' : '/crear-cuenta';
  return <div className="marketing-page investment-landing">
    <MarketingHeader authenticated={Boolean(auth)} />
    <main id="contenido">
      <section className="invest-hero">
        <div className="invest-hero-art" aria-hidden="true"><InvestmentArtwork scene="horizon" priority /></div>
        <div className="invest-hero-copy"><Link href="/mercados" className="invest-announcement"><span />UN NUEVO HORIZONTE PARA TRADINGLAB<ChevronRight size={14} /></Link>
          <h1>Tu próximo paso.<br /><span>Con más criterio.</span></h1>
          <p>ETFs, cripto, divisas y acciones. Un solo espacio para<br className="desktop-break" /> entender los mercados y practicar tus decisiones.</p>
          <div className="invest-hero-actions"><Link href={destination} className="invest-button">Empieza gratis <ArrowRight size={17} /></Link><Link href="/mercados" className="invest-text-link">Explorar mercados <ArrowUpRight size={17} /></Link></div>
          <div className="invest-hero-note"><ShieldCheck size={14} />USD 10.000 virtuales · Sin tarjeta · Cuenta DEMO</div>
        </div>
        <PlatformPreview samples={samples} />
        <div className="invest-market-strip">{[['ETFs', 'Diversifica tu perspectiva'], ['Cripto', 'Un mercado que no duerme'], ['Divisas', 'Conecta con el mundo'], ['Acciones', 'Entiende cada empresa']].map(([a,b]) => <Link href="/mercados" key={a}><strong>{a}</strong><span>{b}</span><ArrowUpRight size={15} /></Link>)}</div>
      </section>
      <section className="invest-section" id="producto"><div className="invest-section-heading"><span className="invest-eyebrow">MENOS FRICCIÓN. MÁS PERSPECTIVA.</span><h2>Todo conectado.<br /><span>Todo tiene sentido.</span></h2><p>De encontrar una idea a entender su resultado.<br />Cada herramienta está donde la necesitas.</p></div>
        <div className="invest-feature-grid"><Link href="/mercados" className="invest-feature feature-universe"><Layers3 size={25} /><h3>Un universo.<br />Tu propia selección.</h3><p>Busca, filtra y organiza tu seguimiento entre {SYMBOLS.length} instrumentos de práctica.</p><div className="invest-brand-stack">{['SPY', 'BTCUSD', 'EURUSD', 'AAPL', 'QQQ'].map(s => <AssetIcon key={s} symbol={s} size="lg" decorative={false} />)}</div><span className="invest-feature-link">Explorar mercados <ArrowUpRight size={18} /></span></Link>
        <Link href="/terminal" className="invest-feature feature-terminal"><Compass size={25} /><h3>Profundidad cuando<br />la necesitas.</h3><p>Gráficos, indicadores y control de riesgo. Cambia entre una vista simple y un espacio avanzado.</p><div className="invest-mini-bars" aria-hidden="true">{[30,55,42,66,40,78,62,86,74,96,82,105].map((h,i)=><span key={i} style={{height:h}} />)}</div><span className="invest-feature-link">Conocer la terminal <ArrowUpRight size={18} /></span></Link>
        <Link href="/entrenador" className="invest-feature feature-coach"><Sparkles size={25} /><h3>Más contexto.<br />Mejores preguntas.</h3><p>El entrenador conecta tus análisis con escenarios, riesgos y explicaciones comprensibles.</p><div className="invest-coach-example"><span>UNA PREGUNTA QUE CAMBIA EL ANÁLISIS</span><p>¿Qué tendría que pasar para que tu hipótesis dejara de ser válida?</p></div><span className="invest-feature-link">Descubrir el entrenador <ArrowUpRight size={18} /></span></Link></div>
      </section>
      <section className="invest-learning visual-home-learning" id="metodo"><div className="invest-section"><div className="home-learning-intro"><div><span className="invest-eyebrow">EL CONOCIMIENTO SE CONSTRUYE</span><h2>Empieza donde estás.<br /><span>Llega más preparado.</span></h2><p>Una ruta que acompaña tu experiencia. Aprende un concepto, pruébalo en demo y revisa tus decisiones.</p><Link href="/recursos" className="invest-button secondary">Encuentra tu punto de partida <ArrowRight size={16} /></Link></div><div className="home-learning-art"><InvestmentArtwork scene="learning" sizes="(max-width: 760px) 100vw, 50vw" /></div></div><div className="home-learning-steps">{[[BookOpen,'01','Entiende','Conceptos claros, ejemplos y lecciones cortas.'],[Globe2,'02','Explora','Compara mercados y encuentra tu enfoque.'],[Compass,'03','Practica','Define entrada, salida y riesgo en tu cuenta demo.'],[Sparkles,'04','Evoluciona','Revisa el proceso en tu diario y estadísticas.']].map(([Icon,n,title,body])=>{const I=Icon as typeof BookOpen;return <div key={String(n)}><span className="home-step-top"><I size={22} /><small>{String(n)}</small></span><h3>{String(title)}</h3><p>{String(body)}</p></div>;})}</div></div></section>
      <PricingPlans />
      <section className="invest-closing invest-closing-visual"><InvestmentArtwork scene="possibilities" sizes="(max-width: 760px) 100vw, 1200px" /><div className="invest-closing-copy"><span className="invest-eyebrow">EL PRIMER PASO ES TUYO</span><h2>Abre<br />posibilidades.</h2><p>Tu cuenta demo te está esperando.<br />Dale espacio a lo que puedes aprender.</p><Link href={destination} className="invest-button">Crear mi espacio <ArrowRight size={17} /></Link><small>USD 10.000 virtuales · Sin tarjeta</small></div></section>
    <InstallSection />
    </main><MarketingFooter />
  </div>;
}
