import Link from 'next/link';
import Image from 'next/image';
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
    <div className="marketing-page">
      <MarketingHeader authenticated={Boolean(auth)} />

      <main id="contenido">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section id="simulador" className="relative overflow-hidden border-b border-[var(--color-border)]">
          <div aria-hidden="true" className="mesh-aurora absolute inset-0 -z-20" />
          <div aria-hidden="true" className="grid-lines absolute inset-0 -z-10 opacity-40" />

          <div className="mx-auto max-w-7xl px-5 pb-16 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
            <div className="mb-10 flex flex-wrap items-center gap-3 text-[11px] font-medium text-[var(--color-muted)]">
              <SimulationPill />
              <span className="hidden h-4 w-px bg-[var(--color-border-strong)] sm:block" aria-hidden="true" />
              <span>Aprende · practica · mejora</span>
              <span className="ml-auto hidden text-[var(--color-subtle)] sm:block">Sin tarjeta · sin depósitos · sin riesgo real</span>
            </div>

            <div className="grid items-center gap-16 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-20">
              <div className="animate-fade-up">

                <h1 className="max-w-2xl text-[3.2rem] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[4.65rem]">
                  Aprende a analizar los mercados{' '}
                  <span className="editorial italic text-[var(--color-blue)]">sin arriesgar tu dinero</span>
                </h1>

                <p className="mt-7 max-w-xl text-[16px] leading-[1.65] text-[var(--color-muted)] sm:text-[17px]">
                  Practica con USD 10.000 virtuales, estudia Forex, criptomonedas, acciones y otros mercados, y
                  mejora cada decisión con análisis educativo impulsado por inteligencia artificial.
                </p>

                <div className="mt-9 flex flex-wrap items-center gap-3">
                  <Link href="/crear-cuenta">
                    <Button size="lg" className="rounded-full px-6">
                      Crear mi cuenta DEMO
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link href="/recursos">
                    <Button size="lg" variant="outline" className="rounded-full px-6">
                      Explorar la academia
                    </Button>
                  </Link>
                </div>

                <dl className="mt-12 grid max-w-xl grid-cols-3 gap-5 border-t border-[var(--color-border)] pt-7 sm:gap-8">
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
                <div className="relative isolate">
                  <Image
                    src="/images/tradinglab-hero.webp"
                    alt="Composición editorial con gráfico de mercado y capas de vidrio"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 58vw"
                    className="pointer-events-none -inset-10 -z-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] object-cover object-right opacity-90 mix-blend-multiply"
                  />
                  <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[3rem] bg-[radial-gradient(circle_at_80%_45%,#2459e82b,transparent_65%)] blur-2xl" />
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
                  <div className="absolute -bottom-5 -right-4 hidden rounded-2xl border border-[var(--color-border-strong)] bg-[color-mix(in_srgb,var(--color-surface)_88%,transparent)] px-4 py-3 shadow-[var(--shadow-lifted)] backdrop-blur-xl sm:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-blue)]">Modo aprendizaje</p>
                    <p className="mt-1 text-[12px] text-[var(--color-muted)]">Cada decisión deja una lección.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-16 grid gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-surface)_72%,transparent)] p-4 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:grid-cols-3 sm:p-5">
              <HeroSignal label="Datos para entender" value="Cotizaciones + contexto" />
              <HeroSignal label="Capital de práctica" value="USD 10.000 virtuales" />
              <HeroSignal label="Resultado que importa" value="Tu disciplina" />
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
    </div>
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

function HeroSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2 py-2 sm:px-3">
      <span className="flex size-2 shrink-0 rounded-full bg-[var(--color-positive)] shadow-[0_0_0_5px_var(--color-positive-soft)]" aria-hidden="true" />
      <span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-subtle)]">{label}</span>
        <span className="mt-1 block text-[13px] font-medium text-[var(--color-text)]">{value}</span>
      </span>
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
