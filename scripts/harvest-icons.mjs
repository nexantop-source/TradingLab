/**
 * Cosecha de identidades visuales.
 *
 * El catálogo tiene 334 instrumentos y la aplicación traía arte para 39. El
 * monograma cubre el hueco, pero un logotipo reconocible identifica mejor y más
 * rápido, así que aquí se trae todo el que exista con una licencia que permita
 * redistribuirlo:
 *
 *   · criptomonedas → `cryptocurrency-icons` (CC0), discos ya coloreados;
 *   · divisas       → `flag-icons` (MIT), la bandera de cada moneda;
 *   · acciones      → `simple-icons` (CC0), el glifo de marca sobre su color.
 *
 * Los fondos cotizados no tienen logotipo propio: llevan el de su gestora, que
 * es lo que de verdad los agrupa -SPDR, Vanguard, iShares- y lo que la persona
 * reconoce al mirar una lista.
 *
 * Se ejecuta a mano cuando el catálogo crece: `node scripts/harvest-icons.mjs`.
 * Necesita las tres dependencias instaladas de forma temporal; no entran en el
 * `package.json` porque su resultado son ficheros versionados, no una
 * dependencia de ejecución.
 */
import fs from 'node:fs';
import path from 'node:path';

const PKG = process.argv[2];
if (!PKG) {
  console.error('Uso: node scripts/harvest-icons.mjs <ruta a node_modules con los tres paquetes>');
  process.exit(1);
}
const OUT = 'public/assets/instruments';

/** Moneda → país cuya bandera la representa. */
const CURRENCY_FLAG = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', CHF: 'ch', CAD: 'ca', AUD: 'au', NZD: 'nz',
  MXN: 'mx', COP: 'co', BRL: 'br', CLP: 'cl', ARS: 'ar', PEN: 'pe', ZAR: 'za', TRY: 'tr',
  SEK: 'se', NOK: 'no', DKK: 'dk', CNY: 'cn', INR: 'in', KRW: 'kr', SGD: 'sg', HKD: 'hk',
  PLN: 'pl', CZK: 'cz', HUF: 'hu', ILS: 'il', THB: 'th', PHP: 'ph', UYU: 'uy', TWD: 'tw',
};

/** Acción → identificador de `simple-icons`. Solo lo que existe de verdad. */
const STOCK_ICON = {
  AAPL: 'apple', NVDA: 'nvidia', GOOGL: 'google', META: 'meta', TSLA: 'tesla',
  NFLX: 'netflix', AMD: 'amd', INTC: 'intel', CSCO: 'cisco', MCD: 'mcdonalds',
  NKE: 'nike', VZ: 'verizon', BA: 'boeing', GE: 'generalelectric', SBUX: 'starbucks',
  UBER: 'uber', PYPL: 'paypal', QCOM: 'qualcomm', V: 'visa', MA: 'mastercard',
  KO: 'cocacola', SPOT: 'spotify', ABNB: 'airbnb', SNOW: 'snowflake',
  BABA: 'alibabadotcom', TM: 'toyota', SONY: 'sony', F: 'ford', GM: 'generalmotors',
  SHOP: 'shopify', COIN: 'coinbase', PLTR: 'palantir', MELI: 'mercadopago',
  DAL: 'delta', MAR: 'marriott', DE: 'johndeere', SAP: 'sap', SHEL: 'shell',
  HSBC: 'hsbc', TGT: 'target', ACN: 'accenture', EBAY: 'ebay', ETSY: 'etsy',
  ROKU: 'roku', UPS: 'ups', FDX: 'fedex',
};

/**
 * Bandera de cada indice.
 *
 * Un indice bursatil es, literalmente, el mercado de un pais: la bandera lo
 * identifica mejor que cualquier sigla, y ademas ordena la lista sola cuando
 * hay veintitres seguidos.
 */
const INDEX_FLAG = {
  SPX500: 'us', NAS100: 'us', US30: 'us', US2000: 'us', VIX: 'us', CAN60: 'ca',
  GER40: 'de', UK100: 'gb', JP225: 'jp', HK50: 'hk', EU50: 'eu', ESP35: 'es',
  FRA40: 'fr', BRA60: 'br', MEX35: 'mx', KOR200: 'kr', TWN50: 'tw', IND30: 'in',
  EUR100: 'eu', SUI20: 'ch', SWE30: 'se', CHL30: 'cl', AUS200: 'au',
};

/** Gestora de cada familia de fondos. La imagen que de verdad los agrupa. */
const ETF_ISSUER = {
  spdr: ['SPY', 'GLD', 'XLK', 'XLE', 'XLF', 'XLV', 'XLY', 'XLP', 'XLI', 'XLU', 'XLB', 'XLRE', 'XLC', 'DIA'],
  vanguard: ['VOO', 'VTI', 'VT', 'VXUS', 'BND', 'VNQ', 'VYM', 'VIG', 'VEA', 'VWO', 'VGT', 'VUG', 'VTV'],
  ishares: ['IVV', 'IWM', 'AGG', 'TLT', 'IEF', 'SHY', 'LQD', 'HYG', 'TIP', 'SLV', 'EEM', 'EFA', 'IEFA', 'IJR', 'IJH', 'SOXX', 'IBIT', 'ICLN', 'MCHI', 'INDA', 'EWJ', 'EWG', 'EWZ', 'EWW', 'QUAL', 'MTUM'],
  invesco: ['QQQ', 'DBC', 'RSP'],
  schwab: ['SCHD'],
};

function read(...parts) {
  return fs.readFileSync(path.join(PKG, ...parts), 'utf8');
}

const written = [];
const identities = {};
function write(name, svg) {
  fs.writeFileSync(path.join(OUT, name), svg.trim() + '\n');
  written.push(name);
}

// ── Criptomonedas ───────────────────────────────────────────────────────────
const cryptoDir = path.join(PKG, 'cryptocurrency-icons', 'svg', 'color');
const cryptoAvailable = new Set(fs.readdirSync(cryptoDir).map((f) => f.replace('.svg', '')));

// ── Marcas ──────────────────────────────────────────────────────────────────
/**
 * Un glifo de marca sobre su color, a sangre y cuadrado.
 *
 * `simple-icons` entrega el trazo en una rejilla de 24 y el color oficial por
 * separado. Se monta el disco aquí para que el resultado case con los que ya
 * estaban: fondo de marca, glifo encima. El glifo se pinta blanco o negro según
 * la luminancia del fondo, porque hay marcas cuyo color es casi amarillo y un
 * glifo blanco encima no se vería.
 */
function brandTile(hex, pathData) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ink = luminance > 0.45 ? '#12161c' : '#ffffff';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img"><rect width="32" height="32" fill="#${hex}"/><path fill="${ink}" transform="translate(4 4)" d="${pathData}"/></svg>`;
}

function simpleIcon(slug) {
  const file = path.join(PKG, 'simple-icons', 'icons', `${slug}.svg`);
  if (!fs.existsSync(file)) return null;
  const svg = fs.readFileSync(file, 'utf8');
  const d = /\sd="([^"]+)"/.exec(svg);
  if (!d) return null;
  let hex = null;
  try {
    const data = JSON.parse(read('simple-icons', 'data', 'simple-icons.json'));
    const list = Array.isArray(data) ? data : data.icons;
    const found = list.find((i) => (i.slug ?? i.title.toLowerCase().replace(/[^a-z0-9]/g, '')) === slug);
    hex = found?.hex ?? null;
  } catch {
    hex = null;
  }
  return { d: d[1], hex: hex ?? '1f2a37' };
}

// Se recorre el catálogo real, no una lista aparte: así no se cuela un icono
// para un instrumento que ya no existe ni se olvida uno que acaba de entrar.
const seeds = fs.readFileSync('src/packages/market-data/symbol-seeds.ts', 'utf8');
const rows = (re) => [...seeds.matchAll(re)].map((m) => m[1]);
const stocks = rows(/^\s*\['([A-Z]+)', '[^']*', [\d.]+, '(?:FREE|STANDARD|PREMIUM)'/gm);
const etfs = [...seeds.slice(seeds.indexOf('ETF_SEEDS'), seeds.indexOf('CRYPTO_SEEDS')).matchAll(/\['([A-Z]+)'/g)].map((m) => m[1]);
const cryptos = [...seeds.slice(seeds.indexOf('CRYPTO_SEEDS'), seeds.indexOf('FOREX_SEEDS')).matchAll(/\['([A-Z0-9]+)USD'/g)].map((m) => m[1]);
const forex = [...seeds.slice(seeds.indexOf('FOREX_SEEDS'), seeds.indexOf('INDEX_SEEDS')).matchAll(/\['([A-Z]{6})'/g)].map((m) => m[1]);

for (const base of cryptos) {
  const key = base.toLowerCase();
  if (!cryptoAvailable.has(key)) continue;
  const name = `crypto-${key}.svg`;
  write(name, fs.readFileSync(path.join(cryptoDir, `${key}.svg`), 'utf8'));
  identities[`${base}USD`] = { src: `/assets/instruments/${name}` };
}

const flagsNeeded = new Set();
for (const pair of forex) {
  flagsNeeded.add(pair.slice(0, 3));
  flagsNeeded.add(pair.slice(3));
}
for (const currency of flagsNeeded) {
  const code = CURRENCY_FLAG[currency];
  if (!code) continue;
  const name = `flag-${code}.svg`;
  if (!fs.existsSync(path.join(OUT, name))) {
    write(name, read('flag-icons', 'flags', '4x3', `${code}.svg`));
  }
}
for (const pair of forex) {
  const a = CURRENCY_FLAG[pair.slice(0, 3)];
  const b = CURRENCY_FLAG[pair.slice(3)];
  if (!a || !b) continue;
  identities[pair] = { src: `/assets/instruments/flag-${a}.svg`, secondary: `/assets/instruments/flag-${b}.svg`, kind: 'pair' };
}

let missing = [];
for (const symbol of stocks) {
  const slug = STOCK_ICON[symbol];
  if (!slug) { missing.push(symbol); continue; }
  const icon = simpleIcon(slug);
  if (!icon) { missing.push(`${symbol} (${slug} no existe)`); continue; }
  const name = `brand-${slug}.svg`;
  write(name, brandTile(icon.hex, icon.d));
  identities[symbol] = { src: `/assets/instruments/${name}` };
}

const issuerOf = new Map();
for (const [issuer, list] of Object.entries(ETF_ISSUER)) for (const ticker of list) issuerOf.set(ticker, issuer);
const ISSUER_FILE = { spdr: 'spdr-sandp500-etf-tr.svg', vanguard: 'vanguard.svg', ishares: 'ishares.svg', invesco: 'invesco.svg', schwab: 'schwab.svg' };
for (const ticker of etfs) {
  const issuer = issuerOf.get(ticker);
  if (!issuer) continue;
  identities[ticker] = { src: `/assets/instruments/${ISSUER_FILE[issuer]}`, kind: 'fund' };
}

for (const [symbol, code] of Object.entries(INDEX_FLAG)) {
  const name = `flag-${code}.svg`;
  if (!fs.existsSync(path.join(OUT, name))) {
    write(name, read('flag-icons', 'flags', '4x3', `${code}.svg`));
  }
  identities[symbol] = { src: `/assets/instruments/${name}` };
}

fs.writeFileSync('scripts/harvested-identities.json', JSON.stringify(identities, null, 1));
console.log('svg escritos:', written.length);
console.log('identidades:', Object.keys(identities).length);
console.log('acciones sin logotipo:', missing.length, missing.slice(0, 30).join(', '));
