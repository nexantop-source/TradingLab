import { NextResponse } from 'next/server';
import { marketData, activeProviderId } from '@tl/market-data';
import { LIVE_PAIRS } from '@/packages/market-data/binance-provider';

export const dynamic = 'force-dynamic';

/**
 * Sonda de salud del mercado. Pública, fija y sin datos de nadie.
 *
 * Existe porque un fallo de datos en producción es invisible desde fuera. Se
 * publicó durante días un dólar a 3.343 pesos -inventado por el motor
 * determinístico- sin que nada lo dijera: la interfaz enseñaba un número, la
 * procedencia decía "serie educativa" en letra pequeña y nadie miraba. Esta
 * ruta responde a la única pregunta que importa, y la responde por familia de
 * activo: **¿qué está saliendo de verdad y qué no?**
 *
 * No sustituye a la procedencia que acompaña a cada precio. Sirve para saber,
 * sin entrar a la aplicación y sin credenciales, si hay que arreglar algo.
 */

/** Representative probes only: success does not certify the rest of a family. */
const PROBES: Array<{ symbol: string; family: string }> = [
  { symbol: 'BTCUSD', family: 'CRYPTO' },
  { symbol: 'AAPL', family: 'STOCK' },
  { symbol: 'SPY', family: 'ETF' },
  { symbol: 'EURUSD', family: 'FOREX' },
  { symbol: 'USDCOP', family: 'FOREX_COP' },
  { symbol: 'SPX500', family: 'INDEX' },
  { symbol: 'XAUUSD', family: 'COMMODITY' },
];

let cached: { until: number; value: Promise<unknown> } | undefined;

export async function GET() {
  if (!cached || cached.until <= Date.now()) {
    const value = (async () => {
      const realOnly = process.env.REQUIRE_REAL_MARKET_DATA === 'true';
      const provider = activeProviderId();

      const families = await Promise.all(
        PROBES.map(async ({ symbol, family }) => {
          try {
            const quote = await marketData().getQuote(symbol);
            const { synthetic, freshness, marketStatus, providerLabel, sourceTimestamp } = quote.provenance;
            return {
              family,
              symbol,
              // "Real" es lo contrario de sintético, no lo contrario de viejo:
              // un cierre de viernes es tan real como un precio de ahora.
              real: !synthetic,
              freshness,
              marketStatus,
              source: providerLabel,
              ageSeconds: Math.max(0, Math.round((Date.now() - sourceTimestamp) / 1000)),
            };
          } catch (error) {
            return { family, symbol, real: false, error: error instanceof Error ? error.message : 'sin respuesta' };
          }
        }),
      );

      return {
        provider,
        realOnly,
        scope: 'representative_symbols_only',
        // Real-source availability and realtime freshness are separate facts.
        healthy: families.every((f) => f.real),
        allProbesRealtime: families.every(f => f.real && f.freshness === 'REALTIME' && f.marketStatus === 'OPEN' && f.ageSeconds != null && f.ageSeconds <= 30),
        families,
        // Se conserva la sonda original de los pares en vivo: es la que vigila
        // el pulso por segundo del que depende la terminal de cripto.
        livePairs: await Promise.all(
          LIVE_PAIRS.map(async (symbol) => {
            try {
              const q = await marketData().getQuote(symbol);
              return {
                symbol,
                available: !q.provenance.synthetic && q.provenance.freshness === 'REALTIME',
                source: q.provenance.provider,
                sourceTimestamp: q.provenance.sourceTimestamp,
              };
            } catch {
              return { symbol, available: false };
            }
          }),
        ),
      };
    })();
    cached = { until: Date.now() + 10_000, value };
  }
  return NextResponse.json(await cached.value, { headers: { 'Cache-Control': 'public, max-age=10' } });
}
