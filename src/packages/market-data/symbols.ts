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
    description: 'El par más negociado del mundo. Reacciona a las decisiones del BCE y de la Reserva Federal.',
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
    description: 'Suele moverse más que el EUR/USD. Muy sensible a los datos macroeconómicos británicos.',
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
    description: 'Históricamente ligado a los diferenciales de tipos de interés entre Estados Unidos y Japón.',
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
    description: 'Divisa vinculada a materias primas: correlaciona con el ciclo de la minería.',
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
  },

  // ── Índices ───────────────────────────────────────────────────────────────
  {
    symbol: 'SPX500',
    name: 'Índice S&P 500 (referencia)',
    assetClass: 'INDEX',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 1.5,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 2,
    description: 'Cesta de 500 grandes compañías estadounidenses. Referencia habitual de mercado.',
    minPlan: 'FREE',
    basePrice: 5648.4,
    annualVolatility: 0.16,
    annualDrift: 0.0,
  },
  {
    symbol: 'NAS100',
    name: 'Índice Nasdaq 100 (referencia)',
    assetClass: 'INDEX',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: 3,
    description: 'Concentrado en tecnología. Suele moverse más que un índice amplio.',
    minPlan: 'STANDARD',
    basePrice: 19672.1,
    annualVolatility: 0.21,
    annualDrift: 0.0,
  },
  {
    symbol: 'GER40',
    name: 'Índice de referencia alemán',
    assetClass: 'INDEX',
    quoteCurrency: 'EUR',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 2.5,
    session: { ...SESSIONS.US_EQUITY, openMinuteUtc: 7 * 60, closeMinuteUtc: 15 * 60 + 30, label: 'Lunes a viernes, 07:00 a 15:30 UTC' },
    educationalRisk: 3,
    description: 'Principales compañías cotizadas de Alemania. Útil para comparar regiones.',
    minPlan: 'STANDARD',
    basePrice: 18492.6,
    annualVolatility: 0.18,
    annualDrift: 0.0,
  },

  // ── Commodities ───────────────────────────────────────────────────────────
  {
    symbol: 'XAUUSD',
    name: 'Oro / Dólar estadounidense',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 3,
    session: SESSIONS.METALS,
    educationalRisk: 3,
    description: 'Metal precioso considerado activo refugio. Sensible a tipos reales y al dólar.',
    minPlan: 'FREE',
    basePrice: 2482.15,
    annualVolatility: 0.14,
    annualDrift: 0.0,
  },
  {
    symbol: 'XAGUSD',
    name: 'Plata / Dólar estadounidense',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 3,
    tickSize: 0.001,
    spreadBps: 6,
    session: SESSIONS.METALS,
    educationalRisk: 4,
    description: 'Metal con demanda industrial y financiera. Más volátil que el oro.',
    minPlan: 'STANDARD',
    basePrice: 28.64,
    annualVolatility: 0.26,
    annualDrift: 0.0,
  },
  {
    symbol: 'WTIUSD',
    name: 'Petróleo WTI / Dólar estadounidense',
    assetClass: 'COMMODITY',
    quoteCurrency: 'USD',
    precision: 2,
    tickSize: 0.01,
    spreadBps: 5,
    session: SESSIONS.ENERGY,
    educationalRisk: 5,
    description: 'Crudo de referencia estadounidense. Muy sensible a la geopolítica y a los inventarios.',
    minPlan: 'STANDARD',
    basePrice: 74.82,
    annualVolatility: 0.34,
    annualDrift: 0.0,
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
  symbol, name, basePrice, description, assetClass: 'ETF', quoteCurrency: 'USD',
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
SYMBOLS.push(...EXTRA_FOREX.map(([symbol, name, quoteCurrency, basePrice]): SymbolSeed => ({
  symbol, name, quoteCurrency, basePrice, assetClass: 'FOREX', precision: 4, tickSize: 0.0001,
  spreadBps: 4, session: SESSIONS.FOREX, educationalRisk: 4, minPlan: 'FREE',
  description: 'Par de divisas. Estudia el tipo de cambio y su sensibilidad al contexto económico.',
  annualVolatility: 0.12, annualDrift: 0,
})));

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
