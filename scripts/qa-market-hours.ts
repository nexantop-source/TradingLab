/**
 * Contrasta el estado que declaramos con el que dice la fuente.
 *
 * Nuestro calendario de sesiones es una aproximación: no conoce festivos, y en
 * el caso de las divisas ni siquiera coincidía con su propia etiqueta. Cuando
 * dice «abierto» y el último cruce real fue hace tres días, la interfaz enseña
 * un instrumento activo con un precio que no se mueve, y quien lo mira no tiene
 * forma de saber cuál de las dos cosas es verdad.
 *
 * Esto lo mide instrumento por instrumento: qué decimos, cuándo se cruzó de
 * verdad el último precio y si las dos cosas son compatibles.
 *
 *   npx tsx scripts/qa-market-hours.ts          → resumen por familia
 *   npx tsx scripts/qa-market-hours.ts --divisas → las cincuenta, una a una
 */
import { CompositeMarketDataProvider } from '../src/packages/market-data/composite-provider';
import { SYMBOLS } from '../src/packages/market-data/symbols';
import { marketStatusFor } from '../src/packages/market-data/market-hours';

/**
 * Cuánto puede llevar quieto un precio sin que «abierto» sea mentira.
 *
 * Generoso a propósito: un par exótico puede pasar veinte minutos sin cruzar a
 * media tarde y seguir abierto. Lo que se busca no son minutos de más, son
 * discrepancias de horas o días.
 */
const TOLERANCIA_MS = 90 * 60_000;

async function main() {
  const soloDivisas = process.argv.includes('--divisas');
  const provider = new CompositeMarketDataProvider();
  const ahora = Date.now();

  const universo = soloDivisas ? SYMBOLS.filter((s) => s.assetClass === 'FOREX') : SYMBOLS;
  const quotes = await provider.getQuotes(universo.map((s) => s.symbol));
  const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));

  const filas = universo.map((meta) => {
    const quote = bySymbol.get(meta.symbol);
    // Lo que importa no es lo que dice el calendario por dentro, sino lo que
    // acaba en la pantalla: la procedencia que viaja con el precio. Es lo que
    // lee la persona y lo que decide si la ficha se ve activa.
    const calendario = marketStatusFor(meta.session, ahora);
    const declarado = quote?.provenance.marketStatus ?? calendario;
    const edadMin = quote ? Math.round((ahora - quote.provenance.sourceTimestamp) / 60_000) : null;
    const miente = declarado === 'OPEN' && edadMin != null && edadMin * 60_000 > TOLERANCIA_MS;
    return { meta, quote, declarado, calendario, edadMin, miente };
  });

  if (soloDivisas) {
    console.log('par        declaramos   último cruce      lo que enseña la ficha');
    console.log('─'.repeat(78));
    for (const f of filas.sort((a, b) => a.meta.symbol.localeCompare(b.meta.symbol))) {
      const edad = f.edadMin == null ? 'sin precio' : f.edadMin < 90 ? `hace ${f.edadMin} min` : `hace ${(f.edadMin / 60).toFixed(1)} h`;
      const desvio = f.calendario !== f.declarado ? `  (el calendario decía ${f.calendario})` : '';
      console.log(
        `${f.meta.symbol.padEnd(10)} ${f.declarado.padEnd(12)} ${edad.padEnd(17)} ${f.miente ? '✖ activo con precio parado' : '✔'}${desvio}`,
      );
    }
  }

  const porFamilia: Record<string, { total: number; mienten: number; sinPrecio: number }> = {};
  for (const f of filas) {
    const clase = f.meta.assetClass;
    porFamilia[clase] ??= { total: 0, mienten: 0, sinPrecio: 0 };
    porFamilia[clase].total++;
    if (f.miente) porFamilia[clase].mienten++;
    if (!f.quote) porFamilia[clase].sinPrecio++;
  }

  console.log('\nfamilia       total   declarados abiertos con el precio parado');
  console.log('─'.repeat(62));
  for (const [clase, d] of Object.entries(porFamilia)) {
    console.log(`${clase.padEnd(13)} ${String(d.total).padStart(5)}   ${d.mienten > 0 ? `✖ ${d.mienten}` : '✔ 0'}${d.sinPrecio ? `   (${d.sinPrecio} sin precio)` : ''}`);
  }

  const total = filas.filter((f) => f.miente).length;
  console.log(
    total === 0
      ? '\n✔ Ningún instrumento se declara abierto con el precio parado.'
      : `\n✖ ${total} instrumentos se enseñan activos y llevan más de hora y media sin cruzar precio.`,
  );
  process.exitCode = total === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
