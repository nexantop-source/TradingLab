import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { HeroTerminal, type HeroTicker } from '@/components/marketing/HeroTerminal';
import {
  AICoachSection,
  AcademySection,
  FAQSection,
  FinalCTA,
  HowItWorks,
  MarketsSection,
  PhilosophySection,
  PricingSection,
  type MarketSummary,
  type TrackSummary,
} from '@/components/marketing/sections';
import { Button } from '@tl/ui';
import { SimulationPill } from '@tl/ui/compliance';
import { marketData, SYMBOLS, requireSymbol, snapshotIndicators } from '@tl/market-data';
import { ASSET_CLASSES, type AssetClass } from '@tl/types';
import { getAuth } from '@/lib/auth';
import { TRACKS, trackStats } from '@/content/academy';

// La landing se renderiza en cada petición: `getAuth()` lee la cookie de
// sesión para decidir si la cabecera muestra «Iniciar sesión» o «Ir a mi
// panel», y eso impide cachearla. No es costoso: un visitante anónimo no llega
// a tocar la base de datos, porque `getAuth()` devuelve null en cuanto ve que
// no hay cookie, y el gráfico del hero se calcula en memoria.
export const dynamic = 'force-dynamic';

const HERO_SYMBOL = 'EURUSD';
const HERO_WATCHLIST = ['EURUSD', 'BTCUSD', 'AAPL', 'XAUUSD', 'SPX500'];

export default async function LandingPage() {
  const auth = await getAuth();
  const provider = marketData();

  const meta = requireSymbol(HERO_SYMBOL);
  const [series, quotes] = await Promise.all([
    provider.getCandles({ symbol: HERO_SYMBOL, timeframe: '1h', limit: 160 }),
    provider.getQuotes(HERO_WATCHLIST),
  ]);

  const tickers: HeroTicker[] = quotes.map((q) => {
    const m = requireSymbol(q.symbol);
    return {
      symbol: q.symbol,
      name: m.name,
      price: q.price,
      changePercent: q.changePercent,
      precision: m.precision,
      assetClass: m.assetClass,
    };
  });

  // Vista previa del análisis educativo, calculada con los mismos indicadores
  // que usa el entrenador. No es texto inventado: describe la serie mostrada.
  const indicators = snapshotIndicators(series.candles, ['SMA20', 'RSI14', 'ATR14']);
  const last = series.candles[series.candles.length - 1];
  const sma20 = indicators['SMA20'];
  const rsi = indicators['RSI14'];
  const atr = indicators['ATR14'];
  const above = sma20 != null && last ? last.c > sma20 : true;

  const aiPreview = {
    trend: above
      ? `El precio de ${meta.name} cotiza por encima de su media de 20 periodos, lo que describe una estructura de corto plazo inclinada al lado comprador. Es una observación sobre lo ocurrido, no una previsión.`
      : `El precio de ${meta.name} cotiza por debajo de su media de 20 periodos, lo que describe una estructura de corto plazo inclinada al lado vendedor. Es una observación sobre lo ocurrido, no una previsión.`,
    bullish:
      sma20 != null
        ? `Media de 20 periodos en ${sma20.toFixed(meta.precision)}: ${above ? 'el precio la mantiene como referencia inferior' : 'una recuperación por encima cambiaría la lectura de corto plazo'}.`
        : 'Estructura reciente sin pérdida de mínimos relevantes.',
    bearish:
      rsi != null
        ? `El RSI de 14 periodos marca ${rsi.toFixed(1)}: ${rsi > 65 ? 'el recorrido reciente ya ha sido amplio' : rsi < 35 ? 'el impulso reciente favorece al lado vendedor' : 'no hay un impulso dominante'}.`
        : 'El máximo reciente sigue actuando como referencia superior.',
    question:
      atr != null && last
        ? `Con un rango medio de ${((atr / last.c) * 100).toFixed(2)} % por vela, ¿a qué distancia situarías el stop loss para que no lo active el ruido normal del mercado?`
        : '¿Qué nivel concreto te demostraría que tu hipótesis es incorrecta?',
  };

  // Resumen de mercados a partir del universo real de instrumentos.
  const markets: MarketSummary[] = ASSET_CLASSES.map((assetClass) => {
    const items = SYMBOLS.filter((s) => s.assetClass === assetClass);
    const avgRisk = items.length
      ? Math.round(items.reduce((a, s) => a + s.educationalRisk, 0) / items.length)
      : 3;
    return {
      assetClass: assetClass as AssetClass,
      count: items.length,
      description: MARKET_DESCRIPTIONS[assetClass],
      risk: avgRisk,
      session: items[0]?.session.label ?? 'Por confirmar',
      examples: items.slice(0, 3).map((s) => s.symbol),
      available: items.length > 0,
    };
  });

  const tracks: TrackSummary[] = TRACKS.slice(0, 9).map((t) => {
    const stats = trackStats(t);
    return {
      slug: t.slug,
      title: t.title,
      summary: t.summary,
      level: t.level,
      lessons: stats.lessons,
      minutes: stats.minutes,
    };
  });

  return (
    <>
      <MarketingHeader authenticated={Boolean(auth)} />

      <main id="contenido">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section id="simulador" className="relative overflow-hidden">
          <div aria-hidden="true" className="mesh-aurora absolute inset-0 -z-20" />
          <div aria-hidden="true" className="grid-lines absolute inset-0 -z-10 opacity-40" />

          <div className="mx-auto max-w-6xl px-5 pb-20 pt-32 sm:pt-40">
            <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
              <div className="animate-fade-up">
                <SimulationPill />

                <h1 className="mt-6 text-[2.6rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
                  Aprende a analizar los mercados{' '}
                  <span className="editorial italic text-gradient">sin arriesgar tu dinero</span>
                </h1>

                <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
                  Practica con USD 10.000 virtuales, estudia Forex, criptomonedas, acciones y otros mercados, y
                  mejora cada decisión con análisis educativo impulsado por inteligencia artificial.
                </p>

                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/crear-cuenta">
                    <Button size="lg">
                      Crear mi cuenta DEMO
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link href="/recursos">
                    <Button size="lg" variant="outline">
                      Explorar la academia
                    </Button>
                  </Link>
                </div>

                <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t border-[var(--color-border)] pt-7">
                  <HeroStat value="USD 10.000" label="Saldo virtual al registrarte" />
                  <HeroStat value={`${SYMBOLS.length}`} label="Instrumentos para practicar" />
                  <HeroStat value={`${TRACKS.length}`} label="Rutas educativas" />
                </dl>

                <p className="mt-6 max-w-md text-[11px] leading-relaxed text-[var(--color-subtle)]">
                  TradingLab es una plataforma educativa de análisis y simulación. No es un broker regulado,
                  no admite depósitos de capital de trading y no permite retirar el saldo virtual.
                </p>
              </div>

              <div className="animate-fade-up [animation-delay:120ms]">
                <HeroTerminal
                  candles={series.candles}
                  provenance={series.provenance}
                  tickers={tickers}
                  symbol={meta.symbol}
                  assetName={meta.name}
                  precision={meta.precision}
                  timeframe="1h"
                  aiPreview={aiPreview}
                />
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />
        <MarketsSection markets={markets} />
        <AICoachSection />
        <AcademySection tracks={tracks} />
        <PhilosophySection />
        <PricingSection compact />
        <FAQSection />
        <FinalCTA />
      </main>

      <MarketingFooter />
    </>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd>
        <span className="num block text-lg font-semibold tracking-tight">{value}</span>
        <span className="mt-1 block text-[11px] leading-snug text-[var(--color-muted)]">{label}</span>
      </dd>
    </div>
  );
}

const MARKET_DESCRIPTIONS: Record<string, string> = {
  FOREX:
    'El mercado de divisas: siempre operas un par, comprando una moneda y vendiendo otra. Muy líquido y sensible a los bancos centrales.',
  CRYPTO:
    'Activos digitales sobre registros distribuidos. Mercado abierto todos los días del año y con la mayor volatilidad del catálogo.',
  STOCK:
    'Participaciones en la propiedad de empresas cotizadas. Reaccionan a resultados trimestrales y a expectativas de beneficio.',
  INDEX:
    'Cestas de acciones resumidas en un número. Útiles para estudiar el comportamiento de un mercado completo.',
  COMMODITY:
    'Metales y energía. Responden a oferta física, inventarios, geopolítica y ciclo económico, con lógicas propias.',
  ETF: 'Fondos cotizados que replican índices o cestas. Se incorporarán cuando exista una fuente de datos con licencia adecuada.',
};
