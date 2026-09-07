import type { AssetMeta, MarketSession } from '@tl/types';

/** Sesiones de referencia, expresadas en UTC. Son informativas y educativas. */
const SESSIONS: Record<string, MarketSession> = {
  CRYPTO: {
    alwaysOpen: true,
    days: [0, 1, 2, 3, 4, 5, 6],
    openMinuteUtc: 0,
    closeMinuteUtc: 1440,
    label: '24 h, todos los días',
  },
  FOREX: {
    alwaysOpen: false,
    days: [1, 2, 3, 4, 5],
    openMinuteUtc: 0,
    closeMinuteUtc: 1440,
    label: 'Domingo 22:00 a viernes 22:00 UTC',
  },
  US_EQUITY: {
    alwaysOpen: false,
    days: [1, 2, 3, 4, 5],
    openMinuteUtc: 13 * 60 + 30, // 09:30 ET
    closeMinuteUtc: 20 * 60, // 16:00 ET
    label: 'Lunes a viernes, 13:30 a 20:00 UTC',
  },
  METALS: {
    alwaysOpen: false,
    days: [1, 2, 3, 4, 5],
    openMinuteUtc: 0,
    closeMinuteUtc: 1440,
    label: 'Casi continuo de lunes a viernes',
  },
  ENERGY: {
    alwaysOpen: false,
    days: [1, 2, 3, 4, 5],
    openMinuteUtc: 0,
    closeMinuteUtc: 1380,
    label: 'Lunes a viernes, con pausa diaria',
  },
};

/**
 * Universo de instrumentos disponibles.
 *
 * `basePrice` y `annualVolatility` alimentan el generador determinístico de la
 * fuente sintética. Cuando se conecta un proveedor real, estos campos solo se
 * usan como referencia de presentación.
 */
export interface SymbolSeed extends AssetMeta {
  basePrice: number;
  annualVolatility: number;
  /** Deriva anual, muy pequeña. Solo da textura a la serie sintética. */
  annualDrift: number;
}

export const SYMBOLS: SymbolSeed[] = [
  // ── Forex ──────────────────────────────────────────────────────────────────
  {
    symbol: 'EURUSD',
    name: 'Euro / Dólar estadounidense',
    assetClass: 'FOREX',
    quoteCurrency: 'USD',
    precision: 5,
    tickSize: 0.00001,
    spreadBps: 1.2,
    session: SESSIONS.FOREX,
    educationalRisk: 3,
    description:
      'El par de divisas más negociado del mundo. Cuánto vale un euro en dólares: sube cuando el euro se fortalece y baja cuando lo hace el dólar.',
    minPlan: 'FREE',
    basePrice: 1.0865,
    annualVolatility: 0.07,
    annualDrift: 0.0,
  },
  {
    symbol: 'GBPUSD',
    name: 'Libra esterlina / Dólar estadounidense',
    assetClass: 'FOREX',
    quoteCurrency: 'USD',
    precision: 5,
    tickSize: 0.00001,
    spreadBps: 1.6,
    session: SESSIONS.FOREX,
    educationalRisk: 3,
    description:
      'La libra frente al dólar. Reacciona con fuerza a las decisiones del Banco de Inglaterra y a los datos de inflación británicos.',
    minPlan: 'FREE',
    basePrice: 1.2712,
    annualVolatility: 0.085,
    annualDrift: 0.0,
  },
  {
    symbol: 'USDJPY',
    name: 'Dólar estadounidense / Yen japonés',
    assetClass: 'FOREX',
    quoteCurrency: 'JPY',
    precision: 3,
    tickSize: 0.001,
    spreadBps: 1.4,
    session: SESSIONS.FOREX,
    educationalRisk: 3,
    description:
      'Cuántos yenes cuesta un dólar. Es el termómetro clásico de la diferencia de tipos de interés entre Estados Unidos y Japón.',
    minPlan: 'FREE',
    basePrice: 151.42,
    annualVolatility: 0.09,
    annualDrift: 0.0,
  },
  {
    symbol: 'USDMXN',
    name: 'Dólar estadounidense / Peso mexicano',
    assetClass: 'FOREX',
    quoteCurrency: 'MXN',
    precision: 4,
    tickSize: 0.0001,
    spreadBps: 6,
    session: SESSIONS.FOREX,
    educationalRisk: 4,
    description: 'Par de mercado emergente. Mayor volatilidad y spreads más amplios.',
    minPlan: 'STANDARD',
    basePrice: 17.24,
    annualVolatility: 0.12,
    annualDrift: 0.0,
  },
  {
    symbol: 'AUDUSD',
    name: 'Dólar australiano / Dólar estadounidense',
    assetClass: 'FOREX',
    quoteCurrency: 'USD',
    precision: 5,
    tickSize: 0.00001,
    spreadBps: 1.8,
    session: SESSIONS.FOREX,
    educationalRisk: 3,
    description:
      'Una divisa muy ligada a las materias primas: sigue de cerca la demanda industrial de China y el precio del hierro y el carbón.',
    minPlan: 'STANDARD',
    basePrice: 0.6588,
    annualVolatility: 0.088,
    annualDrift: 0.0,
  },

  // ── Criptomonedas ─────────────────────────────────────────────────────────
  {
    symbol: 'BTCUSD',
    name: 'Bitcoin / Dólar estadounidense',
    assetClass: 'CRYPTO',
    upstreamSymbol: 'BTCUSDT',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 4,
    session: SESSIONS.CRYPTO,
    educationalRisk: 5,
    description: 'El activo digital de mayor capitalización. Alta volatilidad y mercado abierto todos los días.',
    minPlan: 'FREE',
    basePrice: 67420,
    annualVolatility: 0.55,
    annualDrift: 0.0,
  },
  {
    symbol: 'ETHUSD',
    name: 'Ethereum / Dólar estadounidense',
    assetClass: 'CRYPTO',
    upstreamSymbol: 'ETHUSDT',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 5,
    session: SESSIONS.CRYPTO,
    educationalRisk: 5,
    description: 'Red de contratos inteligentes. Su precio suele amplificar los movimientos de Bitcoin.',
    minPlan: 'FREE',
    basePrice: 3285,
    annualVolatility: 0.65,
    annualDrift: 0.0,
  },
  {
    symbol: 'SOLUSD',
    name: 'Solana / Dólar estadounidense',
    assetClass: 'CRYPTO',
    upstreamSymbol: 'SOLUSDT',
    quoteCurrency: 'USD',
    precision: 3,
    tickSize: 0.001,
    spreadBps: 8,
    session: SESSIONS.CRYPTO,
    educationalRisk: 5,
    description: 'Criptoactivo de alta beta. Ejemplo útil para estudiar el riesgo de concentración.',
    minPlan: 'STANDARD',
    basePrice: 148.6,
    annualVolatility: 0.85,
    annualDrift: 0.0,
  },
  {
    symbol: 'XRPUSD',
    name: 'XRP / Dólar estadounidense',
    assetClass: 'CRYPTO',
    upstreamSymbol: 'XRPUSDT',
    quoteCurrency: 'USD',
    precision: 4,
    tickSize: 0.0001,
    spreadBps: 9,
    session: SESSIONS.CRYPTO,
    educationalRisk: 5,
    description: 'Muy sensible a noticias regulatorias. Buen caso para estudiar riesgo de titular.',
    minPlan: 'STANDARD',
    basePrice: 0.5182,
    annualVolatility: 0.78,
    annualDrift: 0.0,
  },

  // ── Acciones ──────────────────────────────────────────────────────────────
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    assetClass: 'STOCK',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 3,
    description: 'Compañía tecnológica de gran capitalización. Reacciona a resultados trimestrales.',
    minPlan: 'FREE',
    basePrice: 224.31,
    annualVolatility: 0.24,
    annualDrift: 0.0,
    upstreamSymbol: 'AAPL',
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    assetClass: 'STOCK',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 3,
    description: 'Software empresarial y computación en la nube. Peso relevante en los índices estadounidenses.',
    minPlan: 'FREE',
    basePrice: 418.72,
    annualVolatility: 0.22,
    annualDrift: 0.0,
    upstreamSymbol: 'MSFT',
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    assetClass: 'STOCK',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 3,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 5,
    description: 'Acción de alta volatilidad. Útil para estudiar el impacto del tamaño de posición.',
    minPlan: 'STANDARD',
    basePrice: 241.05,
    annualVolatility: 0.52,
    annualDrift: 0.0,
    upstreamSymbol: 'TSLA',
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    assetClass: 'STOCK',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 3,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 5,
    description: 'Semiconductores para cómputo acelerado. Movimientos amplios tras publicar resultados.',
    minPlan: 'STANDARD',
    basePrice: 121.44,
    annualVolatility: 0.48,
    annualDrift: 0.0,
    upstreamSymbol: 'NVDA',
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    assetClass: 'STOCK',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 4,
    description: 'Comercio electrónico y servicios en la nube. Sensible al consumo y a los márgenes.',
    minPlan: 'STANDARD',
    basePrice: 186.33,
    annualVolatility: 0.3,
    annualDrift: 0.0,
    upstreamSymbol: 'AMZN',
  },

  // ── Índices ───────────────────────────────────────────────────────────────
  {
    symbol: 'SPX500',
    name: 'S&P 500',
    assetClass: 'INDEX',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 1.5,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 2,
    description:
      'El índice de referencia del mercado estadounidense: las 500 mayores empresas cotizadas, ponderadas por capitalización. Si quieres el fondo que lo replica, está en el catálogo como SPY.',
    minPlan: 'FREE',
    basePrice: 5648.4,
    annualVolatility: 0.16,
    annualDrift: 0.0,
    yahooSymbol: '^GSPC',
    displayTicker: 'SPX',
  },
  {
    symbol: 'NAS100',
    name: 'Nasdaq 100',
    assetClass: 'INDEX',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 3,
    description:
      'Las cien mayores empresas no financieras del Nasdaq, muy concentradas en tecnología. Más volátil que el S&P 500 por su menor diversificación sectorial.',
    minPlan: 'STANDARD',
    basePrice: 19672.1,
    annualVolatility: 0.21,
    annualDrift: 0.0,
    yahooSymbol: '^NDX',
    displayTicker: 'NDX',
  },
  {
    symbol: 'GER40',
    name: 'DAX 40',
    assetClass: 'INDEX',
    yahooSymbol: '^GDAXI',
    displayTicker: 'DAX',
    quoteCurrency: 'EUR',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2.5,
    session: { ...SESSIONS.US_EQUITY, openMinuteUtc: 7 * 60, closeMinuteUtc: 15 * 60 + 30, label: 'Lunes a viernes, 07:00 a 15:30 UTC' },
    educationalRisk: 3,
    description:
      'Las cuarenta mayores empresas alemanas cotizadas en Fráncfort. Cotiza en euros y en horario europeo, que abre y cierra antes que Nueva York.',
    minPlan: 'STANDARD',
    basePrice: 18492.6,
    annualVolatility: 0.18,
    annualDrift: 0.0,
  },

  // ── Commodities ───────────────────────────────────────────────────────────
  {
    symbol: 'XAUUSD',
    name: 'Oro · futuro COMEX',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 3,
    session: SESSIONS.METALS,
    educationalRisk: 3,
    description:
      'El precio de la onza de oro en el contrato de referencia de COMEX. Es el activo refugio clásico: suele moverse contra el dólar y contra los tipos de interés reales.',
    minPlan: 'FREE',
    basePrice: 2482.15,
    annualVolatility: 0.14,
    annualDrift: 0.0,
    yahooSymbol: 'GC=F',
    displayTicker: 'XAU',
  },
  {
    symbol: 'XAGUSD',
    name: 'Plata · futuro COMEX',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 3,
    tickSize: 0.001,
    spreadBps: 6,
    session: SESSIONS.METALS,
    educationalRisk: 4,
    description:
      'La onza de plata en COMEX. Tiene demanda industrial además de financiera, y por eso es bastante más volátil que el oro.',
    minPlan: 'STANDARD',
    basePrice: 28.64,
    annualVolatility: 0.26,
    annualDrift: 0.0,
    yahooSymbol: 'SI=F',
    displayTicker: 'XAG',
  },
  {
    symbol: 'WTIUSD',
    name: 'Petróleo WTI · futuro NYMEX',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 5,
    session: SESSIONS.ENERGY,
    educationalRisk: 5,
    description:
      'El barril de crudo estadounidense en su contrato de referencia. Muy sensible a la geopolítica, a las decisiones de la OPEP y a los inventarios semanales.',
    minPlan: 'STANDARD',
    basePrice: 74.82,
    annualVolatility: 0.34,
    annualDrift: 0.0,
    yahooSymbol: 'CL=F',
    displayTicker: 'WTI',
  },
];

// Expanded demo universe. These are simulation parameters, never live quotes.
const ETF_SEEDS: Array<[string, string, number, string]> = [
  ['SPY', 'SPDR S&P 500 ETF Trust', 560, 'Grandes empresas de Estados Unidos.'],
  ['VOO', 'Vanguard S&P 500 ETF', 515, 'Exposición amplia al S&P 500.'],
  ['QQQ', 'Invesco QQQ Trust', 475, 'Las principales compañías no financieras del Nasdaq.'],
  ['VTI', 'Vanguard Total Stock Market ETF', 275, 'Renta variable estadounidense de distintos tamaños.'],
  ['VT', 'Vanguard Total World Stock ETF', 115, 'Renta variable de mercados desarrollados y emergentes.'],
  ['VXUS', 'Vanguard Total International Stock ETF', 62, 'Acciones internacionales fuera de Estados Unidos.'],
  ['IWM', 'iShares Russell 2000 ETF', 215, 'Pequeñas empresas estadounidenses.'],
  ['SCHD', 'Schwab US Dividend Equity ETF', 28, 'Empresas estadounidenses seleccionadas por dividendos.'],
  ['BND', 'Vanguard Total Bond Market ETF', 73, 'Bonos estadounidenses con grado de inversión.'],
  ['TLT', 'iShares 20+ Year Treasury Bond ETF', 95, 'Bonos del Tesoro estadounidense a largo plazo.'],
  ['GLD', 'SPDR Gold Shares', 230, 'Exposición al precio del oro mediante un fondo.'],
  ['EEM', 'iShares MSCI Emerging Markets ETF', 43, 'Renta variable de mercados emergentes.'],
  ['XLK', 'Technology Select Sector SPDR Fund', 220, 'Sector tecnológico del S&P 500.'],
  ['XLE', 'Energy Select Sector SPDR Fund', 90, 'Sector energético del S&P 500.'],
  ['VNQ', 'Vanguard Real Estate ETF', 92, 'Sector inmobiliario mediante valores cotizados.'],
];
SYMBOLS.push(...ETF_SEEDS.map(([symbol, name, basePrice, description]): SymbolSeed => ({
  // Son fondos estadounidenses reales y su ticker de catalogo es el de bolsa,
  // asi que Finnhub los cotiza directamente sin traduccion.
  symbol, name, basePrice, description, assetClass: 'ETF', quoteCurrency: 'USD',
  upstreamSymbol: symbol,
  precision: 2, tickSize: 0.01, spreadBps: 2, session: SESSIONS.US_EQUITY,
  educationalRisk: 3, minPlan: 'FREE', annualVolatility: 0.2, annualDrift: 0,
})));
const EXTRA_CRYPTO: Array<[string, string, number]> = [
  ['ADAUSD', 'Cardano / Dólar estadounidense', 0.35], ['DOGEUSD', 'Dogecoin / Dólar estadounidense', 0.12],
  ['AVAXUSD', 'Avalanche / Dólar estadounidense', 25], ['LINKUSD', 'Chainlink / Dólar estadounidense', 12],
  ['DOTUSD', 'Polkadot / Dólar estadounidense', 4.5], ['LTCUSD', 'Litecoin / Dólar estadounidense', 65],
  ['BNBUSD', 'BNB / Dólar estadounidense', 550], ['UNIUSD', 'Uniswap / Dólar estadounidense', 6.5],
];
SYMBOLS.push(...EXTRA_CRYPTO.map(([symbol, name, basePrice]): SymbolSeed => ({
  upstreamSymbol: symbol.replace(/USD$/, 'USDT'),
  symbol, name, basePrice, assetClass: 'CRYPTO', quoteCurrency: 'USD', precision: 4,
  tickSize: 0.0001, spreadBps: 10, session: SESSIONS.CRYPTO, educationalRisk: 5,
  description: 'Criptoactivo de alta volatilidad. Serie sintética para practicar gestión del riesgo.',
  minPlan: 'FREE', annualVolatility: 0.7, annualDrift: 0,
})));
const EXTRA_FOREX: Array<[string, string, string, number]> = [
  ['USDCHF', 'Dólar estadounidense / Franco suizo', 'CHF', 0.86],
  ['USDCAD', 'Dólar estadounidense / Dólar canadiense', 'CAD', 1.36],
  ['NZDUSD', 'Dólar neozelandés / Dólar estadounidense', 'USD', 0.61],
  ['EURGBP', 'Euro / Libra esterlina', 'GBP', 0.85],
  ['EURJPY', 'Euro / Yen japonés', 'JPY', 162],
  ['GBPJPY', 'Libra esterlina / Yen japonés', 'JPY', 190],
  ['USDCOP', 'Dólar estadounidense / Peso colombiano', 'COP', 4100],
];
// Los decimales siguen a la magnitud del par, no a una regla global: cuatro
// decimales sobre un peso colombiano de 3.115 son ruido, y dos sobre un euro
// de 1,16 esconden el movimiento del dia.
const forexPrecision = (basePrice: number) => (basePrice >= 500 ? 2 : basePrice >= 20 ? 3 : 4);
SYMBOLS.push(...EXTRA_FOREX.map(([symbol, name, quoteCurrency, basePrice]): SymbolSeed => ({
  symbol, name, quoteCurrency, basePrice, assetClass: 'FOREX',
  precision: forexPrecision(basePrice), tickSize: 10 ** -forexPrecision(basePrice),
  spreadBps: 4, session: SESSIONS.FOREX, educationalRisk: 4, minPlan: 'FREE',
  description: 'Par de divisas. Estudia el tipo de cambio y su sensibilidad al contexto económico.',
  annualVolatility: 0.12, annualDrift: 0,
})));

// New IDs preserve historical USD simulations and identify the actual quote currency.
for (const [symbol,name,basePrice] of [['BTCUSDT','Bitcoin / Tether',80000],['ETHUSDT','Ethereum / Tether',3000],['SOLUSDT','Solana / Tether',150]] as const) {
  SYMBOLS.unshift({symbol,name,basePrice,quoteCurrency:'USDT',assetClass:'CRYPTO',precision:2,tickSize:.01,spreadBps:8,session:SESSIONS.CRYPTO,educationalRisk:5,minPlan:'FREE',description:'Referencia Binance Spot en USDT. Ejercicios con saldo virtual, sin ejecución en el exchange.',annualVolatility:.7,annualDrift:0});
}
const BY_SYMBOL = new Map(SYMBOLS.map((s) => [s.symbol, s]));

export function getSymbol(symbol: string): SymbolSeed | undefined {
  return BY_SYMBOL.get(symbol.toUpperCase());
}

export function requireSymbol(symbol: string): SymbolSeed {
  const found = getSymbol(symbol);
  if (!found) throw new Error(`Instrumento desconocido: ${symbol}`);
  return found;
}

export function listSymbols(assetClass?: string): SymbolSeed[] {
  if (!assetClass) return SYMBOLS;
  return SYMBOLS.filter((s) => s.assetClass === assetClass);
}

export function searchSymbols(query: string, limit = 20): SymbolSeed[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYMBOLS.slice(0, limit);
  return SYMBOLS.filter(
    (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
  ).slice(0, limit);
}

/** Símbolos que un usuario nuevo ve en su watchlist inicial. */
export const DEFAULT_WATCHLIST = ['EURUSD', 'BTCUSD', 'AAPL', 'XAUUSD', 'SPX500', 'ETHUSD'];
