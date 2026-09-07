import type { MarketDataProvider } from './provider';
import { SyntheticMarketDataProvider } from './synthetic-provider';
import { BinanceMarketDataProvider } from './binance-provider';
import { FinnhubMarketDataProvider } from './finnhub-provider';
import { YahooMarketDataProvider } from './yahoo-provider';
import { FxFallbackProvider } from './fx-fallback-provider';
import { CompositeMarketDataProvider } from './composite-provider';

/**
 * Registro de proveedores.
 *
 * Añadir un proveedor comercial consiste en:
 *   1. Implementar `MarketDataProvider` en `src/packages/market-data/providers/<id>.ts`.
 *   2. Registrarlo aquí con `registerProvider`.
 *   3. Cambiar `MARKET_DATA_PROVIDER` en el entorno.
 *
 * Ninguna otra parte del código cambia: el resto de la aplicación solo conoce
 * la interfaz. Ver `docs/MARKET_DATA.md`.
 */
const registry = new Map<string, MarketDataProvider>();

export function registerProvider(provider: MarketDataProvider): void {
  registry.set(provider.id, provider);
}

const synthetic = new SyntheticMarketDataProvider();
registerProvider(synthetic);
// Alias para poder seleccionarlo por nombre corto desde el entorno.
registry.set('synthetic', synthetic);
const binance = new BinanceMarketDataProvider();
registerProvider(binance);
registry.set('binance', binance);
const finnhub = new FinnhubMarketDataProvider();
registerProvider(finnhub);
registry.set('finnhub', finnhub);
const yahoo = new YahooMarketDataProvider();
registerProvider(yahoo);
registry.set('yahoo', yahoo);
const fxFallback = new FxFallbackProvider();
registerProvider(fxFallback);
// El enrutador es el proveedor recomendado: manda cada instrumento a la fuente
// que de verdad lo cubre y falla, en vez de simular, cuando ninguna lo hace.
const composite = new CompositeMarketDataProvider();
registerProvider(composite);
registry.set('real', composite);

let activeId = process.env.MARKET_DATA_PROVIDER || 'synthetic';

export function setActiveProvider(id: string): void {
  if (!registry.has(id)) throw new Error(`Proveedor de datos no registrado: ${id}`);
  activeId = id;
}

/**
 * Proveedor activo. Si el configurado no está disponible (por ejemplo, falta
 * la credencial), se degrada al motor determinístico y lo deja registrado,
 * de modo que la interfaz siga mostrando la procedencia correcta.
 */
export function marketData(): MarketDataProvider {
  const p = registry.get(activeId);
  if (p) return p;
  if (process.env.REQUIRE_REAL_MARKET_DATA === 'true') {
    throw new Error('La fuente real configurada no está disponible. Práctica temporalmente bloqueada.');
  }
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[market-data] Proveedor "${activeId}" no registrado. Se usa el motor determinístico local.`,
    );
  }
  return synthetic;
}

export function listProviders(): MarketDataProvider[] {
  return Array.from(new Set(registry.values()));
}

export function activeProviderId(): string {
  return activeId;
}
