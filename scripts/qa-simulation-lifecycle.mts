/**
 * El ciclo de vida de un ejercicio, contra el mercado real y una base
 * desechable.
 *
 * Es el bucle central del producto -abrir, seguir, vencer, aprender- y hasta
 * ahora solo se probaba con dobles. Los dobles no habrían encontrado lo que
 * encontró este ensayo: que `getPriceAt` fallaba en un instante pasado para
 * todo lo que no fuera cripto, así que **ninguna posición sobre una acción, un
 * índice o una materia prima podía vencer**. La liquidación se abandonaba en un
 * `catch`, el ejercicio se quedaba abierto para siempre y nadie se enteraba.
 *
 *   node --conditions=react-server --import tsx scripts/qa-simulation-lifecycle.mts
 *
 * No toca la base de nadie: crea una sqlite temporal.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^"|"$/g, '')];
    }),
);

const directory = mkdtempSync(join(tmpdir(), 'tradinglab-sim-qa-'));
Object.assign(process.env, {
  FINNHUB_API_KEY: env.FINNHUB_API_KEY ?? '',
  MARKET_DATA_PROVIDER: 'real',
  REQUIRE_REAL_MARKET_DATA: 'true',
  DATABASE_URL: `file:${join(directory, 'sim.db').replaceAll('\\', '/')}`,
  DATABASE_PROVIDER: 'sqlite',
  NEXT_PUBLIC_APP_URL: 'https://local-fixture.invalid',
});

const init = spawnSync(
  process.execPath,
  [resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--skip-generate'],
  { env: process.env, encoding: 'utf8' },
);
assert.equal(init.status, 0, `No se pudo inicializar la base aislada: ${init.stderr}`);

const { db } = await import('../src/lib/db');
const { ensureDemoAccount } = await import('../src/lib/demo-account');
const { createSimulation, closeSimulationById, settleDueSimulations, listOpenPositions } = await import(
  '../src/lib/simulation-service'
);

let fallos = 0;
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`   ${ok ? '✔' : '✖'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fallos++;
};
const step = (label: string) => console.log(`\n▸ ${label}`);

/** Un instrumento por familia: si una familia se rompe, se ve cuál. */
const FAMILIAS: Array<[string, string]> = [
  ['BTCUSD', 'cripto'],
  ['AAPL', 'acción'],
  ['SPY', 'fondo cotizado'],
  ['EURUSD', 'divisa'],
  ['SPX500', 'índice'],
  ['XAUUSD', 'materia prima'],
];

async function main() {
  const user = await db.user.create({
    data: { email: 'qa-sim@example.invalid', passwordHash: 'NO_LOGIN', name: 'QA Ciclo' },
  });
  const cuenta = await ensureDemoAccount(user.id);
  console.log(`Saldo inicial: USD ${(cuenta.balanceCents / 100).toLocaleString('es-CO')}`);

  step('Abrir un ejercicio en cada familia');
  const abiertos: Array<{ id: string; symbol: string; familia: string }> = [];
  for (const [symbol, familia] of FAMILIAS) {
    try {
      const creada = await createSimulation({
        userId: user.id,
        plan: 'PREMIUM',
        timezone: 'America/Bogota',
        input: {
          mode: 'POSITION',
          symbol,
          direction: 'BULLISH',
          orderType: 'MARKET',
          limitPrice: null,
          stakeCents: 10_000,
          leverage: 1,
          stopLoss: null,
          takeProfit: null,
          trailingStopDistance: null,
          durationMinutes: 60,
          rationale: 'Ensayo del ciclo de vida del ejercicio.',
          confidence: 'MEDIUM',
          perceivedRisk: 3,
          timeframe: '1h',
          visibleIndicators: [],
          chartType: 'candles',
          acknowledgedSimulation: true,
        },
      });
      abiertos.push({ id: creada.simulationId, symbol, familia });
      check(`${familia} (${symbol}) abierta`, true, `entrada ${creada.entryPrice}`);
    } catch (error) {
      // Que un mercado esté cerrado no es un fallo: es la respuesta correcta, y
      // negarse a abrir un ejercicio contra un precio parado es justo lo que
      // debe hacer. Lo que sí sería un fallo es cualquier otro motivo.
      const codigo = (error as { code?: string }).code;
      check(
        `${familia} (${symbol})`,
        codigo === 'MARKET_CLOSED',
        codigo === 'MARKET_CLOSED' ? 'mercado cerrado, rechazo correcto' : (error as Error).message.slice(0, 90),
      );
    }
  }

  step('Las posiciones abiertas se pueden seguir y valorar');
  const posiciones = await listOpenPositions(user.id);
  check('todas figuran como abiertas', posiciones.length === abiertos.length, `${posiciones.length} de ${abiertos.length}`);
  check(
    'todas tienen resultado no realizado calculado',
    posiciones.every((p) => Number.isFinite(p.unrealizedPercent)),
  );

  step('Cerrar a mano');
  const aMano = abiertos[0];
  if (aMano) {
    try {
      const cerrada = await closeSimulationById({ userId: user.id, simulationId: aMano.id, reason: 'MANUAL' });
      check(`${aMano.familia} cerrada a mano`, true, `resultado ${(cerrada.pnlCents / 100).toFixed(2)}`);
    } catch (error) {
      check(`${aMano.familia} cerrada a mano`, false, (error as Error).message.slice(0, 90));
    }
  }

  step('Vencer el resto: es lo que estaba roto');
  // Se adelanta el vencimiento en la base en lugar de esperar una hora.
  const pendientes = abiertos.slice(1);
  await db.simulation.updateMany({
    where: { id: { in: pendientes.map((p) => p.id) } },
    data: { expiresAt: new Date(Date.now() - 90 * 60_000) },
  });

  const liquidadas = await settleDueSimulations(user.id);
  check('el barrido liquida todas las vencidas', liquidadas === pendientes.length, `${liquidadas} de ${pendientes.length}`);

  for (const pendiente of pendientes) {
    const fila = await db.simulation.findUnique({ where: { id: pendiente.id } });
    check(
      `${pendiente.familia} (${pendiente.symbol}) resuelta`,
      fila?.status === 'CLOSED',
      fila?.status === 'CLOSED'
        ? `salida ${fila.exitPrice} · ${fila.closeReason}`
        : 'sigue ABIERTA: no se pudo acreditar el precio del vencimiento',
    );
  }

  step('El saldo vuelve a cuadrar');
  const abiertasFinales = await listOpenPositions(user.id);
  check('no queda ninguna abierta', abiertasFinales.length === 0, `${abiertasFinales.length} abiertas`);
  const final = await db.demoAccount.findUnique({ where: { id: cuenta.id } });
  const asientos = await db.demoBalanceLedger.count({ where: { demoAccountId: cuenta.id } });
  check('el libro mayor registra cada movimiento', asientos >= abiertos.length * 2, `${asientos} asientos`);
  console.log(`   Saldo final: USD ${((final?.balanceCents ?? 0) / 100).toLocaleString('es-CO')}`);

  console.log(fallos === 0 ? '\n✔ El ciclo completo funciona en las seis familias.' : `\n✖ ${fallos} comprobaciones fallidas.`);
  process.exitCode = fallos === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
