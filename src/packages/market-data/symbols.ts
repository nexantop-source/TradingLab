import type { AssetMeta, MarketSession } from '@tl/types';
import { COMMODITY_SEEDS, CRYPTO_SEEDS, ETF_SEEDS, FOREX_SEEDS, INDEX_SEEDS, STOCK_SEEDS } from './symbol-seeds';

/**
 * Sesiones de referencia, expresadas en UTC. Son informativas y educativas: se
 * usan para decir si un mercado está abierto y para explicar por qué un precio
 * lleva horas quieto, no para decidir una ejecución.
 */
const SESSIONS: Record<string, MarketSession> = {
  CRYPTO: { alwaysOpen: true, days: [0, 1, 2, 3, 4, 5, 6], openMinuteUtc: 0, closeMinuteUtc: 1440, label: '24 h, todos los días' },
  FOREX: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 1440, label: 'Domingo 22:00 a viernes 22:00 UTC' },
  US_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 13 * 60 + 30, closeMinuteUtc: 20 * 60, label: 'Lunes a viernes, 13:30 a 20:00 UTC' },
  EU_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 7 * 60, closeMinuteUtc: 15 * 60 + 30, label: 'Lunes a viernes, 07:00 a 15:30 UTC' },
  UK_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 8 * 60, closeMinuteUtc: 16 * 60 + 30, label: 'Lunes a viernes, 08:00 a 16:30 UTC' },
  JP_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 6 * 60, label: 'Lunes a viernes, 00:00 a 06:00 UTC' },
  HK_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 60, closeMinuteUtc: 8 * 60, label: 'Lunes a viernes, 01:00 a 08:00 UTC' },
  KR_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 6 * 60 + 30, label: 'Lunes a viernes, 00:00 a 06:30 UTC' },
  TW_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 60, closeMinuteUtc: 5 * 60 + 30, label: 'Lunes a viernes, 01:00 a 05:30 UTC' },
  IN_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 3 * 60 + 45, closeMinuteUtc: 10 * 60, label: 'Lunes a viernes, 03:45 a 10:00 UTC' },
  AU_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 6 * 60, label: 'Lunes a viernes, 00:00 a 06:00 UTC' },
  LATAM_EQUITY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 13 * 60, closeMinuteUtc: 21 * 60, label: 'Lunes a viernes, 13:00 a 21:00 UTC' },
  METALS: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 1440, label: 'Casi continuo de lunes a viernes' },
  ENERGY: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 0, closeMinuteUtc: 1380, label: 'Lunes a viernes, con pausa diaria' },
  AGRI: { alwaysOpen: false, days: [1, 2, 3, 4, 5], openMinuteUtc: 13 * 60, closeMinuteUtc: 18 * 60 + 20, label: 'Lunes a viernes, 13:00 a 18:20 UTC' },
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

/**
 * Decimales proporcionales a la magnitud.
 *
 * Cuatro decimales sobre un peso colombiano de 3.115 son ruido; ocho sobre un
 * Shiba Inu de 0,000008 son el precio entero. Un catálogo cuyos precios van de
 * la millonésima a las decenas de miles no admite un número fijo de decimales.
 */
function precisionFor(price: number): number {
  if (price >= 500) return 2;
  if (price >= 20) return 3;
  if (price >= 1) return 4;
  if (price >= 0.01) return 6;
  return 8;
}

/**
 * Los decimales de una divisa no siguen la misma regla.
 *
 * Un cruce por debajo de uno -EUR/GBP a 0,858- no necesita seis decimales como
 * los necesitaría una criptomoneda al mismo precio: el mercado de divisas
 * cotiza en pips, y el quinto decimal ya es el pipette. Pasar de ahí sería
 * inventar una resolución que la fuente no tiene.
 */
function forexPrecision(price: number): number {
  if (price >= 500) return 2;
  if (price >= 20) return 3;
  return 5;
}

const CURRENCY_NAME: Record<string, string> = {
  USD: 'Dólar estadounidense', EUR: 'Euro', GBP: 'Libra esterlina', JPY: 'Yen japonés',
  CHF: 'Franco suizo', CAD: 'Dólar canadiense', AUD: 'Dólar australiano', NZD: 'Dólar neozelandés',
  MXN: 'Peso mexicano', COP: 'Peso colombiano', BRL: 'Real brasileño', CLP: 'Peso chileno',
  ARS: 'Peso argentino', PEN: 'Sol peruano', ZAR: 'Rand sudafricano', TRY: 'Lira turca',
  SEK: 'Corona sueca', NOK: 'Corona noruega', DKK: 'Corona danesa', CNY: 'Yuan chino',
  INR: 'Rupia india', KRW: 'Won surcoreano', SGD: 'Dólar de Singapur', HKD: 'Dólar de Hong Kong',
  PLN: 'Zloti polaco', CZK: 'Corona checa', HUF: 'Forinto húngaro', ILS: 'Séquel israelí',
  THB: 'Baht tailandés', PHP: 'Peso filipino', UYU: 'Peso uruguayo',
};

/**
 * Descripciones escritas a mano para los instrumentos que la gente busca por su
 * nombre.
 *
 * El resto recibe una descripción construida a partir de lo que sabemos de
 * cierto: su clase, su divisa, su horario. Es menos vistosa, pero no inventa un
 * relato sobre una empresa que nadie ha mirado. Entre una frase honesta y
 * genérica y otra específica y adivinada, la primera.
 */
const DESCRIPTIONS: Record<string, string> = {
  AAPL: 'Compañía tecnológica de gran capitalización. Reacciona a resultados trimestrales y al ciclo de renovación de sus productos.',
  MSFT: 'Software empresarial y computación en la nube. Peso relevante en los índices estadounidenses.',
  NVDA: 'Semiconductores para cómputo acelerado. Movimientos amplios tras publicar resultados.',
  TSLA: 'Acción de alta volatilidad. Útil para estudiar el impacto del tamaño de posición.',
  AMZN: 'Comercio electrónico y servicios en la nube. Sensible al consumo y a los márgenes.',
  GOOGL: 'Buscador, publicidad y nube. Su resultado depende en buena parte del ciclo publicitario.',
  META: 'Redes sociales y publicidad digital, con una apuesta de gasto elevada en plataformas nuevas.',
  KO: 'Consumo básico global. Suele moverse menos que el mercado, lo que la hace un buen contraste con una tecnológica.',
  JPM: 'Banca de inversión y comercial. Los bancos reaccionan a los tipos de interés antes que casi ningún otro sector.',
  BRKB: 'El vehículo de inversión de Warren Buffett: un conglomerado que a la vez posee empresas enteras y una cartera de acciones cotizadas.',
  COIN: 'Bolsa de criptomonedas cotizada. Su resultado sigue de cerca el volumen del mercado cripto, así que amplifica sus ciclos.',
  MSTR: 'Compañía de software cuyo balance está mayoritariamente invertido en bitcoin, lo que la convierte en una apuesta apalancada sobre él.',
  EC: 'Petrolera colombiana cotizada en Nueva York. Un caso cercano para estudiar cómo el crudo y el peso mueven una misma acción.',
  SPY: 'El fondo cotizado más negociado del mundo. Replica el S&P 500 y su precio ronda una décima parte del índice.',
  QQQ: 'Fondo cotizado que replica el Nasdaq 100. Concentrado en tecnología, y por eso más volátil que el S&P 500.',
  VOO: 'Exposición amplia al S&P 500 con una de las comisiones más bajas del mercado.',
  VTI: 'Renta variable estadounidense completa: grandes, medianas y pequeñas empresas en una sola posición.',
  VT: 'Renta variable de todo el mundo, desarrollados y emergentes, en un único fondo.',
  BND: 'Bonos estadounidenses con grado de inversión. Sirve para ver cómo se comporta la renta fija cuando la bolsa cae.',
  TLT: 'Bonos del Tesoro a más de veinte años. Muy sensible a los tipos de interés: es el ejemplo clásico de duración.',
  GLD: 'Fondo respaldado por oro físico en custodia. Sigue al metal, pero su precio es una fracción de la onza.',
  SLV: 'Fondo respaldado por plata física.',
  IBIT: 'Fondo cotizado con bitcoin en custodia. Da exposición al activo desde una cuenta de bolsa corriente.',
  ARKK: 'Fondo de gestión activa concentrado en compañías de crecimiento. Un buen caso para estudiar qué hace la concentración.',
  BTCUSD: 'El activo digital de mayor capitalización. Alta volatilidad y mercado abierto todos los días.',
  ETHUSD: 'Red de contratos inteligentes. Su precio suele amplificar los movimientos de Bitcoin.',
  SOLUSD: 'Criptoactivo de alta beta. Ejemplo útil para estudiar el riesgo de concentración.',
  XRPUSD: 'Muy sensible a noticias regulatorias. Buen caso para estudiar el riesgo de titular.',
  DOGEUSD: 'Nació como una broma y se mueve con la atención pública. El ejemplo más claro de un precio sin fundamento operativo.',
  SHIBUSD: 'Criptoactivo de precio unitario muy bajo. La cantidad de ceros no lo hace barato: lo que importa es su capitalización.',
  EURUSD: 'El par de divisas más negociado del mundo. Cuánto vale un euro en dólares: sube cuando el euro se fortalece y baja cuando lo hace el dólar.',
  GBPUSD: 'La libra frente al dólar. Reacciona con fuerza a las decisiones del Banco de Inglaterra y a los datos de inflación británicos.',
  USDJPY: 'Cuántos yenes cuesta un dólar. Es el termómetro clásico de la diferencia de tipos de interés entre Estados Unidos y Japón.',
  USDCOP: 'El dólar frente al peso colombiano. Se mueve con el petróleo, con la prima de riesgo del país y con las decisiones del Banco de la República.',
  AUDUSD: 'Una divisa muy ligada a las materias primas: sigue de cerca la demanda industrial de China y el precio del hierro y el carbón.',
};

/** Instrumentos que merecen un aviso de riesgo más alto que el de su clase. */
const HIGH_RISK = new Set([
  'TSLA', 'NVDA', 'COIN', 'MSTR', 'PLTR', 'RIVN', 'LCID', 'NIO', 'SNOW', 'ROKU', 'SOFI', 'ETSY',
  'ARKK', 'SOXX', 'SMH', 'GDX', 'USO', 'UNG', 'IBIT', 'ICLN', 'JETS',
]);

const SYMBOLS: SymbolSeed[] = [];

// ── Acciones ────────────────────────────────────────────────────────────────
for (const [symbol, name, basePrice, minPlan, yahoo] of STOCK_SEEDS) {
  SYMBOLS.push({
    symbol, name, basePrice, minPlan,
    assetClass: 'STOCK', quoteCurrency: 'USD', precision: 2, tickSize: 0.01, spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: HIGH_RISK.has(symbol) ? 5 : 3,
    description: DESCRIPTIONS[symbol]
      ?? `Acción de ${name}. Su precio responde a los resultados trimestrales de la compañía y a lo que el mercado espera de su negocio.`,
    upstreamSymbol: yahoo ?? symbol,
    // Un ticker con guion -BRK-B- no cabe en un identificador interno, así que
    // el catálogo usa BRKB y aquí se guarda el que entiende la fuente, que es
    // además el que reconoce la persona.
    ...(yahoo ? { yahooSymbol: yahoo, displayTicker: yahoo } : {}),
    annualVolatility: 0.3, annualDrift: 0,
  });
}

// ── Fondos cotizados ────────────────────────────────────────────────────────
for (const [symbol, name, basePrice, minPlan] of ETF_SEEDS) {
  SYMBOLS.push({
    symbol, name, basePrice, minPlan,
    assetClass: 'ETF', quoteCurrency: 'USD', precision: 2, tickSize: 0.01, spreadBps: 2,
    session: SESSIONS.US_EQUITY,
    educationalRisk: HIGH_RISK.has(symbol) ? 4 : 2,
    description: DESCRIPTIONS[symbol]
      ?? 'Fondo cotizado. Una sola posición reparte el dinero entre todos los valores que replica, así que su recorrido es el del conjunto y no el de una empresa.',
    // Son fondos estadounidenses reales y su ticker de catálogo es el de bolsa,
    // así que la fuente los cotiza directamente, sin traducción.
    upstreamSymbol: symbol,
    annualVolatility: 0.2, annualDrift: 0,
  });
}

// ── Criptomonedas ───────────────────────────────────────────────────────────
for (const [symbol, name, basePrice, minPlan, binance, yahoo] of CRYPTO_SEEDS) {
  const precision = precisionFor(basePrice);
  SYMBOLS.push({
    symbol, name: `${name} / Dólar estadounidense`, basePrice, minPlan, precision,
    assetClass: 'CRYPTO', quoteCurrency: 'USD', tickSize: 10 ** -precision,
    spreadBps: 8, session: SESSIONS.CRYPTO, educationalRisk: 5,
    description: DESCRIPTIONS[symbol]
      ?? `${name} es un criptoactivo. El mercado no cierra ningún día del año y sus oscilaciones son amplias: sirve para estudiar cómo el tamaño de la posición cambia el riesgo, más que para adivinar su rumbo.`,
    // El par que existe de verdad se negocia contra Tether, y esa traducción la
    // hace el proveedor de Binance. Lo que Binance no lista se cotiza en Yahoo,
    // donde el ticker no se puede derivar porque no sigue ningún patrón.
    ...(binance ? { upstreamSymbol: binance } : {}),
    yahooSymbol: yahoo,
    annualVolatility: 0.7, annualDrift: 0,
  });
}

// ── Divisas ─────────────────────────────────────────────────────────────────
for (const [symbol, basePrice, minPlan] of FOREX_SEEDS) {
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  const precision = forexPrecision(basePrice);
  SYMBOLS.push({
    symbol, basePrice, minPlan, precision,
    name: `${CURRENCY_NAME[base] ?? base} / ${CURRENCY_NAME[quote] ?? quote}`,
    assetClass: 'FOREX', quoteCurrency: quote, tickSize: 10 ** -precision,
    spreadBps: base === 'USD' || quote === 'USD' ? 2 : 4,
    session: SESSIONS.FOREX,
    educationalRisk: base === 'USD' && !['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD'].includes(quote) ? 4 : 3,
    description: DESCRIPTIONS[symbol]
      ?? `Cuántos ${(CURRENCY_NAME[quote] ?? quote).toLowerCase()} cuesta un ${(CURRENCY_NAME[base] ?? base).toLowerCase()}. Un tipo de cambio se mueve por la diferencia entre dos economías, nunca por una sola.`,
    annualVolatility: 0.12, annualDrift: 0,
  });
}

// ── Índices ─────────────────────────────────────────────────────────────────
for (const [symbol, name, yahoo, session, currency, basePrice, minPlan, description] of INDEX_SEEDS) {
  SYMBOLS.push({
    symbol, name, basePrice, minPlan, description,
    assetClass: 'INDEX', quoteCurrency: currency, precision: 2, tickSize: 0.01, spreadBps: 2,
    session: SESSIONS[session] ?? SESSIONS.US_EQUITY,
    educationalRisk: symbol === 'VIX' ? 5 : 2,
    yahooSymbol: yahoo,
    displayTicker: yahoo.replace('^', ''),
    annualVolatility: 0.18, annualDrift: 0,
  });
}

// ── Materias primas ─────────────────────────────────────────────────────────
for (const [symbol, name, yahoo, session, precision, basePrice, minPlan, description] of COMMODITY_SEEDS) {
  SYMBOLS.push({
    symbol, name, basePrice, minPlan, description, precision,
    assetClass: 'COMMODITY', quoteCurrency: 'USD', tickSize: 10 ** -precision, spreadBps: 4,
    session: SESSIONS[session] ?? SESSIONS.METALS,
    educationalRisk: session === 'ENERGY' || session === 'AGRI' ? 5 : 3,
    yahooSymbol: yahoo,
    displayTicker: yahoo.replace('=F', ''),
    annualVolatility: 0.3, annualDrift: 0,
  });
}

// Estos identificadores existen desde antes y hay simulaciones guardadas contra
// ellos: se conservan tal cual, con su cotización en USDT de Binance, aunque el
// mismo activo aparezca también como par contra el dólar.
for (const [symbol, name, basePrice] of [['BTCUSDT', 'Bitcoin / Tether', 80000], ['ETHUSDT', 'Ethereum / Tether', 3000], ['SOLUSDT', 'Solana / Tether', 150]] as const) {
  SYMBOLS.unshift({
    symbol, name, basePrice, quoteCurrency: 'USDT', assetClass: 'CRYPTO', precision: 2,
    tickSize: 0.01, spreadBps: 8, session: SESSIONS.CRYPTO, educationalRisk: 5, minPlan: 'FREE',
    description: 'Referencia Binance Spot en USDT. Ejercicios con saldo virtual, sin ejecución en el exchange.',
    annualVolatility: 0.7, annualDrift: 0,
  });
}

export { SYMBOLS };

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

/**
 * Búsqueda de instrumentos.
 *
 * Ordena por dónde cae la coincidencia y no por el orden del catálogo. Con
 * trescientos instrumentos eso deja de ser un detalle: quien escribe "AAP"
 * espera Apple en la primera fila, no la primera acción del alfabeto cuyo
 * nombre contenga esas tres letras en alguna parte.
 */
export function searchSymbols(query: string, limit = 20): SymbolSeed[] {
  const q = query.trim().toLowerCase();
  if (!q) return SYMBOLS.slice(0, limit);
  const score = (s: SymbolSeed): number => {
    const symbol = s.symbol.toLowerCase();
    const ticker = (s.displayTicker ?? '').toLowerCase();
    const name = s.name.toLowerCase();
    if (symbol === q || ticker === q) return 0;
    if (symbol.startsWith(q) || ticker.startsWith(q)) return 1;
    if (name.startsWith(q)) return 2;
    if (symbol.includes(q) || ticker.includes(q)) return 3;
    if (name.includes(q)) return 4;
    return Number.POSITIVE_INFINITY;
  };
  return SYMBOLS.map((s) => [s, score(s)] as const)
    .filter(([, rank]) => Number.isFinite(rank))
    .sort((a, b) => a[1] - b[1] || a[0].symbol.localeCompare(b[0].symbol))
    .slice(0, limit)
    .map(([s]) => s);
}

/** Símbolos que un usuario nuevo ve en su watchlist inicial. */
export const DEFAULT_WATCHLIST = ['EURUSD', 'BTCUSD', 'AAPL', 'XAUUSD', 'SPX500', 'ETHUSD'];
