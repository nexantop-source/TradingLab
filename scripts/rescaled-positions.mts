/**
 * Posiciones demo abiertas sobre instrumentos que cambiaron de escala.
 *
 * Divisas, índices y materias primas dejaron de cotizarse a través de un fondo
 * que los imitaba y pasaron a su subyacente real. Es lo correcto -EUR/USD tiene
 * que valer 1,16 y no 107, que era el precio de un ETF con otro nombre-, pero
 * cambia el orden de magnitud del precio. Una posición abierta antes del cambio
 * quedó con un precio de entrada de la escala vieja y un precio actual de la
 * nueva, así que su resultado no significa nada:
 *
 *     EUR/USD  entrada 107,15   →  actual 1,1629   →  -98,9 %
 *
 * Ese número no es una pérdida: es una comparación entre dos cosas distintas.
 * Este script las encuentra y, si se le pide, las cierra al precio de entrada
 * -resultado cero, saldo devuelto- porque es lo único honesto que se puede
 * hacer con un ejercicio cuya referencia cambió a mitad de camino.
 *
 *   node --conditions=react-server --import tsx scripts/rescaled-positions.mts
 *   node --conditions=react-server --import tsx scripts/rescaled-positions.mts --cerrar
 *
 * Sin `--cerrar` solo informa. Contra la base que diga `DATABASE_URL`.
 */
import { db } from '../src/lib/db';
import { getSymbol } from '../src/packages/market-data/symbols';

/**
 * Instrumentos que cambiaron de vehículo, con la escala vieja y la nueva.
 *
 * `antes` es el precio de referencia del fondo que los imitaba el día del
 * cambio; `ahora`, el del subyacente. No se usan para calcular nada: sirven
 * para reconocer una entrada de la escala vieja sin tener que adivinar.
 */
const RESCALED: Record<string, { antes: number; ahora: number; vehiculo: string }> = {
  EURUSD: { antes: 107.15, ahora: 1.16, vehiculo: 'FXE' },
  GBPUSD: { antes: 118.0, ahora: 1.35, vehiculo: 'FXB' },
  USDJPY: { antes: 61.0, ahora: 154.0, vehiculo: 'FXY' },
  AUDUSD: { antes: 63.0, ahora: 0.72, vehiculo: 'FXA' },
  SPX500: { antes: 770.0, ahora: 7718.0, vehiculo: 'SPY' },
  NAS100: { antes: 719.0, ahora: 29544.0, vehiculo: 'QQQ' },
  GER40: { antes: 40.0, ahora: 26006.0, vehiculo: 'EWG' },
  XAUUSD: { antes: 406.0, ahora: 4476.0, vehiculo: 'GLD' },
  XAGUSD: { antes: 60.0, ahora: 66.7, vehiculo: 'SLV' },
  WTIUSD: { antes: 70.0, ahora: 91.5, vehiculo: 'USO' },
};

/**
 * ¿La entrada pertenece a la escala vieja?
 *
 * Se compara contra las dos referencias y gana la más cercana en proporción, no
 * en diferencia absoluta: entre 107 y 1,16, un precio de 90 está claramente en
 * la escala vieja aunque su distancia a 1,16 sea menor en pesos. Se exige
 * además que las dos escalas difieran de verdad -un factor de tres para
 * arriba-, porque en XAG y WTI el cambio fue pequeño y ahí no se puede
 * distinguir sin inventar.
 */
function esEscalaVieja(entrada: number, escala: { antes: number; ahora: number }): boolean | null {
  const factor = Math.max(escala.antes, escala.ahora) / Math.min(escala.antes, escala.ahora);
  if (factor < 3) return null;
  const distancia = (a: number, b: number) => Math.abs(Math.log(a / b));
  return distancia(entrada, escala.antes) < distancia(entrada, escala.ahora);
}

async function main() {
  const cerrar = process.argv.includes('--cerrar');
  const abiertas = await db.simulation.findMany({
    where: { status: 'OPEN', symbol: { in: Object.keys(RESCALED) } },
    select: { id: true, userId: true, symbol: true, entryPrice: true, stakeCents: true, openedAt: true },
    orderBy: { openedAt: 'asc' },
  });

  if (abiertas.length === 0) {
    console.log('No hay posiciones abiertas sobre instrumentos reescalados. Nada que hacer.');
    return;
  }

  const afectadas: typeof abiertas = [];
  const dudosas: typeof abiertas = [];
  for (const posicion of abiertas) {
    const veredicto = esEscalaVieja(posicion.entryPrice, RESCALED[posicion.symbol]);
    if (veredicto === true) afectadas.push(posicion);
    else if (veredicto === null) dudosas.push(posicion);
  }

  console.log(`Posiciones abiertas sobre instrumentos reescalados: ${abiertas.length}`);
  console.log(`  con entrada en la escala vieja: ${afectadas.length}`);
  console.log(`  imposibles de distinguir (el cambio fue pequeño): ${dudosas.length}`);
  console.log();

  for (const posicion of afectadas) {
    const escala = RESCALED[posicion.symbol];
    const precision = getSymbol(posicion.symbol)?.precision ?? 2;
    console.log(
      `  ${posicion.symbol.padEnd(8)} entrada ${posicion.entryPrice.toFixed(precision).padStart(12)} ` +
        `(escala de ${escala.vehiculo}) · abierta ${posicion.openedAt.toISOString().slice(0, 10)} · ${posicion.id}`,
    );
  }

  if (!cerrar) {
    console.log();
    console.log('Solo se ha informado. Para cerrarlas al precio de entrada -resultado cero y saldo');
    console.log('devuelto- vuelve a ejecutar con --cerrar.');
    return;
  }

  console.log();
  for (const posicion of afectadas) {
    // Al precio de entrada: el ejercicio no ganó ni perdió, porque la
    // referencia contra la que se planteó dejó de existir a mitad de camino.
    await db.$transaction(async (tx) => {
      await tx.simulation.update({
        where: { id: posicion.id },
        data: {
          status: 'CLOSED',
          exitPrice: posicion.entryPrice,
          pnlCents: 0,
          closedAt: new Date(),
          closeReason: 'INSTRUMENT_RESCALED',
          outcome: 'NEUTRAL',
        },
      });
      const cuenta = await tx.demoAccount.findUnique({ where: { userId: posicion.userId } });
      if (!cuenta) return;
      const saldo = cuenta.balanceCents + posicion.stakeCents;
      await tx.demoAccount.update({ where: { userId: posicion.userId }, data: { balanceCents: saldo } });
      await tx.demoLedgerEntry.create({
        data: {
          demoAccountId: cuenta.id,
          amountCents: posicion.stakeCents,
          balanceAfterCents: saldo,
          reason: 'SIMULATION_MARGIN_RELEASE',
          reference: posicion.id,
          memo: `El instrumento ${posicion.symbol} pasó a cotizarse por su subyacente y cambió de escala. `
            + 'El ejercicio se cerró sin resultado y se devolvió el importe.',
        },
      });
    });
    console.log(`  cerrada ${posicion.id} (${posicion.symbol})`);
  }
  console.log(`\nCerradas ${afectadas.length}. El importe volvió al saldo virtual de cada cuenta.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
