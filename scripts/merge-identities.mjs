/**
 * Funde lo cosechado con lo que ya estaba curado a mano.
 *
 * Las entradas existentes ganan siempre: alguien las eligio una por una y
 * algunas son mejores que su equivalente automatico. Lo cosechado solo rellena
 * huecos, que es de lo que se trataba.
 *
 * `node scripts/merge-identities.mjs`
 */
import fs from 'node:fs';

const FILE = 'src/components/investment/instrument-identities.json';
const existing = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const harvested = JSON.parse(fs.readFileSync('scripts/harvested-identities.json', 'utf8'));

// El nombre del instrumento sale del catalogo: la etiqueta de la identidad es
// lo que lee un lector de pantalla, y "BRENTUSD" no le dice nada a nadie.
const seeds = fs.readFileSync('src/packages/market-data/symbol-seeds.ts', 'utf8');
const NAME = new Map();
for (const [, symbol, name] of seeds.matchAll(/\['([A-Z0-9]+)', '([^']+)'/g)) NAME.set(symbol, name);
for (const [, symbol, name] of seeds.matchAll(/\['([A-Z0-9]+)', '([^']+)', '[^']+', '[^']+'/g)) NAME.set(symbol, name);

const CURRENCY = {
  USD: 'USD', EUR: 'EUR', GBP: 'GBP', JPY: 'JPY', CHF: 'CHF', CAD: 'CAD', AUD: 'AUD',
  NZD: 'NZD', MXN: 'MXN', COP: 'COP', BRL: 'BRL', CLP: 'CLP', ARS: 'ARS', PEN: 'PEN',
  ZAR: 'ZAR', TRY: 'TRY', SEK: 'SEK', NOK: 'NOK', DKK: 'DKK', CNY: 'CNY', INR: 'INR',
  KRW: 'KRW', SGD: 'SGD', HKD: 'HKD', PLN: 'PLN', CZK: 'CZK', HUF: 'HUF', ILS: 'ILS',
  THB: 'THB', PHP: 'PHP', UYU: 'UYU',
};

function labelFor(symbol) {
  if (/^[A-Z]{6}$/.test(symbol) && CURRENCY[symbol.slice(0, 3)] && CURRENCY[symbol.slice(3)]) {
    return `${symbol.slice(0, 3)} / ${symbol.slice(3)}`;
  }
  if (NAME.has(symbol)) return NAME.get(symbol);
  const crypto = symbol.replace(/USD$/, '');
  if (crypto !== symbol && NAME.has(crypto)) return NAME.get(crypto);
  return symbol;
}

const merged = { ...harvested, ...existing };
for (const [symbol, identity] of Object.entries(merged)) {
  if (!identity.label || identity.label.length < 2) identity.label = labelFor(symbol);
}

const ordered = Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]]));
fs.writeFileSync(FILE, JSON.stringify(ordered, null, 2) + '\n');
console.log('identidades totales:', Object.keys(ordered).length, '| nuevas:', Object.keys(ordered).length - Object.keys(existing).length);
