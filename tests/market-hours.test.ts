import { describe, expect, it } from 'vitest';
import { getSymbol } from '@tl/market-data';
import { marketStatusFor, observedMarketStatus, lastOpenTimestamp } from '../src/packages/market-data/market-hours';

/**
 * Cuándo decimos que un mercado está abierto.
 *
 * Se enseñaban instrumentos activos con un precio que llevaba horas o días sin
 * moverse, y por dos motivos distintos que conviene no mezclar.
 *
 * El primero es que la sesión de divisas no hacía lo que decía su etiqueta.
 * Prometía «domingo 22:00 a viernes 22:00 UTC» y por dentro hacía «lunes 00:00
 * a viernes 24:00», que no es lo mismo en dos tramos de dos horas cada semana.
 *
 * El segundo es que ningún calendario escrito a mano puede acertar: no conoce
 * los festivos, no acierta los minutos de veintitrés plazas y no sigue sus
 * cambios de horario. Para eso está la fuente, que sí sabe cuándo se cruzó el
 * último precio.
 */

/** Semana del 6 al 12 de septiembre de 2026. El 6 es domingo. */
const DOMINGO = 6;

describe('la ventana semanal de las divisas', () => {
  const forex = getSymbol('EURUSD')!.session;

  it('abre el domingo por la tarde, como promete su etiqueta', () => {
    expect(forex.label).toContain('Domingo 22:00');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, DOMINGO, 21, 0))).toBe('CLOSED');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, DOMINGO, 21, 45))).toBe('PRE_OPEN');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, DOMINGO, 22, 30))).toBe('OPEN');
  });

  it('cierra el viernes a las 22:00 y no a medianoche', () => {
    // Este era el tramo que enseñaba un mercado cerrado como si estuviera vivo.
    expect(marketStatusFor(forex, Date.UTC(2026, 8, 11, 21, 30))).toBe('OPEN');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, 11, 22, 30))).toBe('CLOSED');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, 11, 23, 30))).toBe('CLOSED');
  });

  it('sigue abierta toda la madrugada del miércoles', () => {
    // Lo que una franja horaria diaria no puede describir: la ventana no se
    // interrumpe al pasar la medianoche.
    expect(marketStatusFor(forex, Date.UTC(2026, 8, 9, 2, 0))).toBe('OPEN');
    expect(marketStatusFor(forex, Date.UTC(2026, 8, 9, 23, 59))).toBe('OPEN');
  });

  it('el sábado está cerrada entera', () => {
    for (const hora of [0, 6, 12, 18, 23]) {
      expect(marketStatusFor(forex, Date.UTC(2026, 8, 12, hora))).toBe('CLOSED');
    }
  });

  it('congela el fin de semana en el cierre real del viernes', () => {
    const cierre = Date.UTC(2026, 8, 11, 22) - 1;
    for (const momento of [Date.UTC(2026, 8, 11, 23), Date.UTC(2026, 8, 12, 15), Date.UTC(2026, 8, DOMINGO + 7, 10)]) {
      expect(lastOpenTimestamp(forex, momento)).toBe(cierre);
    }
    expect(marketStatusFor(forex, cierre)).toBe('OPEN');
  });
});

describe('cuando el calendario y la fuente no coinciden', () => {
  const forex = getSymbol('EURUSD')!.session;
  const acciones = getSymbol('AAPL')!.session;
  /** Martes por la mañana: para el calendario, los dos mercados están abiertos. */
  const martes = Date.UTC(2026, 8, 8, 14, 0);

  it('parte del calendario cuando la fuente lo confirma', () => {
    expect(marketStatusFor(acciones, martes)).toBe('OPEN');
    expect(observedMarketStatus(acciones, martes, martes - 30_000)).toBe('OPEN');
  });

  it('cree a la fuente cuando lleva horas sin cruzar precio', () => {
    // El caso del Día del Trabajo: el calendario da por abierta la bolsa
    // estadounidense y no se ha negociado nada desde el viernes.
    expect(observedMarketStatus(acciones, martes, martes - 3 * 86_400_000)).toBe('CLOSED');
  });

  it('tolera los silencios normales de un par poco líquido', () => {
    // Veinte minutos sin cruzar no es un mercado cerrado, es un par tranquilo.
    expect(observedMarketStatus(forex, martes, martes - 20 * 60_000)).toBe('OPEN');
    // Tres horas y media sí: es el caso del peso chileno fuera de su horario.
    expect(observedMarketStatus(forex, martes, martes - 3.5 * 3_600_000)).toBe('CLOSED');
  });

  it('no asciende a abierto lo que el calendario ya daba por cerrado', () => {
    const sabado = Date.UTC(2026, 8, 12, 12);
    expect(observedMarketStatus(forex, sabado, sabado - 1_000)).toBe('CLOSED');
  });

  it('se queda con el calendario si la fuente no trae una marca creíble', () => {
    expect(observedMarketStatus(acciones, martes, Number.NaN)).toBe('OPEN');
    expect(observedMarketStatus(acciones, martes, 0)).toBe('OPEN');
  });
});
