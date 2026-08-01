import type { AIEducationalAnalysis } from '@tl/types';
import { DISCLAIMERS } from '@tl/types/compliance';
import type { AvailableLesson, JournalContext, MarketContext, TradeContext } from './context';

/**
 * Analizador educativo determinístico.
 *
 * Se usa cuando no hay credenciales de OpenAI configuradas, cuando se supera
 * el tope de coste, o como red de seguridad si la respuesta del modelo no pasa
 * los guardarraíles.
 *
 * No es un "modo degradado" oculto: la interfaz indica siempre qué motor
 * generó el análisis. Cumple exactamente las mismas reglas de conducta: no
 * promete resultados, no inventa precios (usa únicamente las lecturas
 * recibidas) y siempre expone riesgos e incertidumbre.
 */

const ENGINE_ID = 'deterministic-v1';

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return 'no disponible';
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function trendFromIndicators(ctx: MarketContext): {
  label: string;
  bullish: string[];
  bearish: string[];
  indicators: AIEducationalAnalysis['relevantIndicators'];
} {
  const bullish: string[] = [];
  const bearish: string[] = [];
  const indicators: AIEducationalAnalysis['relevantIndicators'] = [];
  const price = ctx.currentPrice;
  const ind = ctx.indicators;

  const sma20 = ind['SMA20'];
  const sma50 = ind['SMA50'];
  const sma200 = ind['SMA200'];
  const rsi = ind['RSI14'];
  const macdLine = ind['MACD_line'];
  const macdSignal = ind['MACD_signal'];
  const atr = ind['ATR14'];
  const bbUpper = ind['BB20_upper'];
  const bbLower = ind['BB20_lower'];

  if (sma20 != null) {
    const above = price > sma20;
    indicators.push({
      name: 'Media móvil simple de 20 periodos',
      reading: fmt(sma20, 4),
      interpretation: above
        ? 'El precio cotiza por encima de esta media, lo que suele leerse como estructura de corto plazo favorable al lado comprador.'
        : 'El precio cotiza por debajo de esta media, lo que suele leerse como estructura de corto plazo favorable al lado vendedor.',
    });
    (above ? bullish : bearish).push(
      `El precio (${fmt(price, 4)}) se sitúa ${above ? 'por encima' : 'por debajo'} de la media de 20 periodos (${fmt(sma20, 4)}).`,
    );
  }

  if (sma20 != null && sma50 != null) {
    const aligned = sma20 > sma50;
    indicators.push({
      name: 'Relación entre medias de 20 y 50',
      reading: `${fmt(sma20, 4)} frente a ${fmt(sma50, 4)}`,
      interpretation: aligned
        ? 'La media rápida está por encima de la lenta: las dos escalas temporales apuntan en el mismo sentido.'
        : 'La media rápida está por debajo de la lenta: el corto plazo no acompaña al plazo intermedio.',
    });
    (aligned ? bullish : bearish).push(
      `Las medias de 20 y 50 periodos están ${aligned ? 'alineadas al alza' : 'alineadas a la baja'}.`,
    );
  }

  if (sma200 != null) {
    const above = price > sma200;
    (above ? bullish : bearish).push(
      `Respecto a la media de 200 periodos (${fmt(sma200, 4)}), el precio se encuentra ${above ? 'por encima' : 'por debajo'}, referencia habitual de tendencia de fondo.`,
    );
  }

  if (rsi != null) {
    let interp: string;
    if (rsi >= 70) {
      interp = 'Lectura elevada. Indica que las subidas recientes han sido intensas, no que el precio deba corregir.';
      bearish.push(`El RSI de 14 periodos está en ${fmt(rsi, 1)}, en zona alta; el recorrido reciente ya ha sido amplio.`);
    } else if (rsi <= 30) {
      interp = 'Lectura baja. Indica caídas intensas recientes, no que el precio deba rebotar.';
      bullish.push(`El RSI de 14 periodos está en ${fmt(rsi, 1)}, en zona baja tras un tramo de caídas.`);
    } else if (rsi > 50) {
      interp = 'Por encima de 50: el impulso reciente se inclina al lado comprador, sin extremos.';
      bullish.push(`El RSI se sitúa en ${fmt(rsi, 1)}, por encima del punto medio.`);
    } else {
      interp = 'Por debajo de 50: el impulso reciente se inclina al lado vendedor, sin extremos.';
      bearish.push(`El RSI se sitúa en ${fmt(rsi, 1)}, por debajo del punto medio.`);
    }
    indicators.push({ name: 'RSI de 14 periodos', reading: fmt(rsi, 1), interpretation: interp });
  }

  if (macdLine != null && macdSignal != null) {
    const above = macdLine > macdSignal;
    indicators.push({
      name: 'MACD (12/26/9)',
      reading: `línea ${fmt(macdLine, 5)}, señal ${fmt(macdSignal, 5)}`,
      interpretation: above
        ? 'La línea MACD está por encima de su señal: el diferencial entre medias exponenciales se ha ampliado al alza.'
        : 'La línea MACD está por debajo de su señal: el diferencial entre medias exponenciales se ha reducido o girado a la baja.',
    });
    (above ? bullish : bearish).push(
      `El MACD tiene su línea ${above ? 'por encima' : 'por debajo'} de la señal.`,
    );
  }

  if (atr != null && price > 0) {
    const atrPct = (atr / price) * 100;
    indicators.push({
      name: 'ATR de 14 periodos',
      reading: fmt(atr, 5),
      interpretation: `Equivale aproximadamente al ${fmt(atrPct, 2)} % del precio actual. Mide amplitud del movimiento, no dirección: úsalo para dimensionar el stop loss, nunca para decidir el sentido.`,
    });
  }

  if (bbUpper != null && bbLower != null) {
    const width = ((bbUpper - bbLower) / price) * 100;
    indicators.push({
      name: 'Bandas de Bollinger (20, 2σ)',
      reading: `${fmt(bbLower, 4)} — ${fmt(bbUpper, 4)}`,
      interpretation: `La anchura equivale al ${fmt(width, 2)} % del precio. Bandas estrechas suelen asociarse a periodos de baja volatilidad; no anticipan hacia dónde se romperá.`,
    });
  }

  const score = bullish.length - bearish.length;
  const label =
    score >= 2
      ? 'Los indicadores calculados se inclinan mayoritariamente hacia el lado comprador, con contradicciones que conviene tener presentes.'
      : score <= -2
        ? 'Los indicadores calculados se inclinan mayoritariamente hacia el lado vendedor, con contradicciones que conviene tener presentes.'
        : 'Los indicadores calculados apuntan en sentidos mixtos: no hay una lectura dominante en este momento.';

  return { label, bullish, bearish, indicators };
}

function recommendLesson(
  lessons: AvailableLesson[],
  topic: string,
  reason: string,
): AIEducationalAnalysis['recommendedLesson'] {
  const match = lessons.find((l) => l.topic === topic) ?? lessons[0];
  if (!match) return null;
  return { slug: match.slug, title: match.title, reason };
}

export function deterministicChartReview(
  ctx: MarketContext,
  lessons: AvailableLesson[],
): AIEducationalAnalysis {
  const { label, bullish, bearish, indicators } = trendFromIndicators(ctx);
  const price = ctx.currentPrice;
  const range = ctx.dayHigh - ctx.dayLow;
  const posInRange = range > 0 ? ((price - ctx.dayLow) / range) * 100 : 50;
  const atr = ctx.indicators['ATR14'];
  const atrPct = atr != null && price > 0 ? (atr / price) * 100 : null;

  // Garantiza al menos una evidencia en cada lado (requisito de equilibrio).
  if (bullish.length === 0) {
    bullish.push(
      `El precio se mantiene a ${fmt(posInRange, 0)} % del rango del día medido desde el mínimo, lo que indica que los compradores han defendido parte del recorrido.`,
    );
  }
  if (bearish.length === 0) {
    bearish.push(
      `El precio no ha logrado superar el máximo del día (${fmt(ctx.dayHigh, 4)}), nivel que sigue actuando como referencia superior.`,
    );
  }

  const eventNote = ctx.upcomingEvents.length
    ? `Hay ${ctx.upcomingEvents.length} evento(s) económico(s) próximo(s) asociado(s) a este instrumento, empezando por "${ctx.upcomingEvents[0].title}". La volatilidad alrededor de esas publicaciones suele aumentar.`
    : 'No hay eventos económicos próximos registrados para este instrumento en la ventana consultada.';

  return {
    contextSummary: `Estás observando ${ctx.assetName} (${ctx.symbol}) en temporalidad ${ctx.timeframe}. El precio se sitúa en ${fmt(price, 4)}, con una variación de ${fmt(ctx.changePercent, 2)} % respecto al cierre anterior. El rango del día va de ${fmt(ctx.dayLow, 4)} a ${fmt(ctx.dayHigh, 4)}, y el precio actual ocupa el ${fmt(posInRange, 0)} % de ese rango contado desde el mínimo. ${ctx.provenance.synthetic ? 'Los precios provienen del motor educativo determinístico, no de un mercado real.' : `Los datos provienen de ${ctx.provenance.providerLabel}.`}`,
    observedTrend: label,
    bullishEvidence: bullish.slice(0, 6),
    bearishEvidence: bearish.slice(0, 6),
    relevantIndicators: indicators.slice(0, 8),
    risks: [
      atrPct != null
        ? `La volatilidad reciente medida por el ATR equivale al ${fmt(atrPct, 2)} % del precio: un stop loss más ajustado que esa distancia tiene alta probabilidad de activarse por ruido normal del mercado.`
        : 'No dispongo de una lectura de ATR en este contexto, por lo que no puedo estimar la volatilidad reciente.',
      eventNote,
      ctx.provenance.marketStatus !== 'OPEN'
        ? 'El mercado de este instrumento figura como cerrado: el último precio puede no reflejar la próxima apertura, que a menudo se produce con hueco.'
        : 'Los indicadores describen lo que ya ocurrió. Ninguno anticipa el futuro, y todos pueden dar señales contradictorias en mercados laterales.',
      'Las lecturas mostradas corresponden a una única temporalidad. En otra escala temporal la estructura puede ser distinta o incluso opuesta.',
    ],
    bullishScenario: `Si el precio consigue superar ${fmt(ctx.dayHigh, 4)} y sostenerse por encima durante varias velas de ${ctx.timeframe}, la estructura de máximos crecientes quedaría reforzada y el escenario comprador ganaría consistencia. Ese escenario dejaría de sostenerse si el precio devuelve inmediatamente la superación.`,
    bearishScenario: `Si el precio pierde ${fmt(ctx.dayLow, 4)} y no lo recupera en las velas siguientes, la referencia inferior quedaría rota y el escenario vendedor ganaría consistencia. Ese escenario perdería validez si se produce una recuperación rápida por encima del nivel perdido.`,
    invalidationConditions: [
      `Cierre de al menos una vela de ${ctx.timeframe} por debajo de ${fmt(ctx.dayLow, 4)} invalidaría la lectura alcista.`,
      `Cierre de al menos una vela de ${ctx.timeframe} por encima de ${fmt(ctx.dayHigh, 4)} invalidaría la lectura bajista.`,
      'La aparición de un evento económico de impacto alto puede invalidar cualquier lectura técnica previa en cuestión de minutos.',
    ],
    questionsForStudent: [
      '¿Qué nivel concreto te demostraría que tu hipótesis es incorrecta, y por qué ese y no otro?',
      '¿Cuánto de tu saldo virtual estás dispuesto a comprometer en esta idea antes de abrirla?',
      '¿Qué verías en una temporalidad superior que pudiera contradecir lo que estás observando aquí?',
      atrPct != null
        ? `Con una volatilidad del ${fmt(atrPct, 2)} % por vela, ¿a qué distancia situarías el stop loss para que no lo active el ruido normal?`
        : '¿Cómo medirías la volatilidad de este instrumento antes de decidir la distancia de tu stop loss?',
    ],
    recommendedLesson: recommendLesson(
      lessons,
      'gestion-del-riesgo',
      'Antes de traducir una lectura del gráfico en una simulación, conviene tener resuelto el tamaño de posición y la distancia del stop loss.',
    ),
    uncertaintyLevel: 'ALTA',
    sourcesUsed: [
      `Cotización y velas de ${ctx.symbol} (${ctx.provenance.providerLabel}), marca temporal ${new Date(ctx.provenance.sourceTimestamp).toISOString()}`,
      'Indicadores calculados por el backend de TradingLab sobre esas mismas velas',
      ...(ctx.upcomingEvents.length ? ['Calendario económico educativo de TradingLab'] : []),
    ],
    educationalDisclaimer: DISCLAIMERS.ai,
  };
}

export function deterministicPostTrade(
  market: MarketContext,
  trade: TradeContext,
  lessons: AvailableLesson[],
): AIEducationalAnalysis {
  const processStrengths: string[] = [];
  const processWeaknesses: string[] = [];

  if (trade.stopLoss != null) processStrengths.push('Definiste un stop loss antes de abrir: sabías de antemano cuánto podías perder.');
  else processWeaknesses.push('No definiste un stop loss: al abrir, no tenías un límite explícito de pérdida.');

  if (trade.takeProfit != null) processStrengths.push('Definiste un objetivo de salida, lo que permite evaluar la operación contra un plan.');
  else processWeaknesses.push('No definiste un objetivo: sin él, la decisión de cerrar queda a merced del momento.');

  if (trade.riskReward != null && trade.riskReward >= 1.5) {
    processStrengths.push(`Tu relación riesgo-beneficio planificada fue ${fmt(trade.riskReward, 2)}: buscabas más de lo que arriesgabas.`);
  } else if (trade.riskReward != null) {
    processWeaknesses.push(`Tu relación riesgo-beneficio planificada fue ${fmt(trade.riskReward, 2)}: arriesgabas más de lo que buscabas obtener.`);
  }

  if (trade.studentRationale.length >= 80) {
    processStrengths.push('Escribiste un motivo detallado, lo que hace que esta simulación sea revisable más adelante.');
  } else {
    processWeaknesses.push('El motivo que escribiste es breve: dentro de un mes será difícil reconstruir qué viste exactamente.');
  }

  if (trade.leverage >= 20) {
    processWeaknesses.push(`Usaste un apalancamiento simulado de ${trade.leverage}:1, que amplifica tanto el resultado como el efecto de cualquier error de dimensionado.`);
  }

  const outcomeText =
    trade.outcome === 'CORRECT'
      ? 'El precio se movió en el sentido de tu hipótesis'
      : trade.outcome === 'INCORRECT'
        ? 'El precio se movió en contra de tu hipótesis'
        : 'El precio quedó prácticamente donde estaba';

  const processQuality = processWeaknesses.length <= 1 ? 'sólido' : processWeaknesses.length <= 2 ? 'mejorable' : 'con margen amplio de mejora';

  const mismatch =
    (trade.outcome === 'CORRECT' && processWeaknesses.length >= 3) ||
    (trade.outcome === 'INCORRECT' && processWeaknesses.length === 0);

  return {
    contextSummary: `Cerraste una simulación ${trade.mode === 'HYPOTHESIS' ? 'de hipótesis direccional' : 'de posición'} ${trade.direction === 'BEARISH' ? 'bajista' : 'alcista'} sobre ${market.symbol}, con entrada en ${fmt(trade.entryPrice, 4)}${trade.exitPrice != null ? ` y salida en ${fmt(trade.exitPrice, 4)}` : ''}. Comprometiste USD ${fmt(trade.stakeUsd, 2)} virtuales${trade.leverage > 1 ? ` con apalancamiento simulado ${trade.leverage}:1` : ''}. ${outcomeText}, con un resultado virtual de USD ${fmt(trade.pnlUsd ?? 0, 2)}.`,
    observedTrend: `El proceso que seguiste fue ${processQuality}.${mismatch ? ' Conviene separar explícitamente el resultado del proceso: en una muestra pequeña, uno no informa sobre el otro.' : ''}`,
    bullishEvidence: processStrengths.length ? processStrengths : ['Completaste la simulación y la dejaste registrada, que es el primer paso para poder revisarla.'],
    bearishEvidence: processWeaknesses.length ? processWeaknesses : ['No se detectan debilidades evidentes en el proceso de esta simulación concreta.'],
    relevantIndicators: [
      {
        name: 'Riesgo comprometido',
        reading: `USD ${fmt(trade.stakeUsd, 2)} virtuales`,
        interpretation: 'Compara este importe con tu saldo virtual total: idealmente cada simulación arriesga una fracción pequeña.',
      },
      ...(trade.riskReward != null
        ? [{
            name: 'Relación riesgo-beneficio planificada',
            reading: fmt(trade.riskReward, 2),
            interpretation: 'Cuánto buscabas obtener por cada unidad arriesgada, según los niveles que definiste al abrir.',
          }]
        : []),
      {
        name: 'Confianza declarada frente a resultado',
        reading: `${trade.confidence} / ${trade.outcome}`,
        interpretation: 'Con el tiempo, comparar tu confianza declarada con el desenlace real revela si estás bien calibrado.',
      },
    ],
    risks: [
      'Una sola simulación no permite concluir nada sobre la calidad de una estrategia. Necesitas decenas de repeticiones del mismo planteamiento.',
      trade.outcome === 'CORRECT'
        ? 'Un resultado favorable puede reforzar hábitos que no fueron los causantes del acierto. Revisa el proceso con el mismo rigor que si hubieras fallado.'
        : 'Un resultado desfavorable puede llevar a abandonar un planteamiento correcto. Revisa si el error estuvo en la idea o solo en el desenlace.',
      ...(processWeaknesses.length >= 3 ? ['La acumulación de debilidades de proceso en una misma simulación suele repetirse: es el patrón, no el caso aislado, lo que conviene corregir.'] : []),
    ],
    bullishScenario: 'Si mantienes el planteamiento y corriges el punto débil identificado, las próximas simulaciones producirán datos comparables entre sí, que es lo que permite evaluar una estrategia.',
    bearishScenario: 'Si cambias de planteamiento después de cada resultado, nunca acumularás una muestra suficiente de ninguno, y no podrás distinguir una estrategia válida de una racha.',
    invalidationConditions: [
      'Si al repetir este planteamiento veinte veces el resultado agregado es sistemáticamente negativo, el problema está en la idea y no en la ejecución.',
      'Si tu porcentaje de aciertos es alto pero el resultado agregado es negativo, el problema está en el tamaño de las pérdidas frente al de las ganancias.',
    ],
    questionsForStudent: [
      '¿El motivo que escribiste antes de abrir se corresponde con lo que realmente hiciste durante la operación?',
      trade.stopLoss == null
        ? '¿Dónde habrías situado el stop loss si lo hubieras definido, y qué te lo impidió?'
        : '¿Respetaste el stop loss que definiste, o lo moviste durante la simulación?',
      '¿Qué harías exactamente igual y qué cambiarías si volvieras a ver este mismo escenario mañana?',
    ],
    recommendedLesson: recommendLesson(
      lessons,
      processWeaknesses.length >= 2 ? 'gestion-del-riesgo' : 'diario-y-disciplina',
      'Refuerza el punto de proceso más débil detectado en esta revisión.',
    ),
    uncertaintyLevel: 'ALTA',
    sourcesUsed: [
      `Registro de la simulación en el motor determinístico de TradingLab (versión del motor almacenada junto a la operación)`,
      `Cotizaciones de ${market.symbol} usadas en apertura y cierre, con su procedencia registrada`,
    ],
    educationalDisclaimer: DISCLAIMERS.ai,
  };
}

export function deterministicJournalReview(
  journal: JournalContext,
  lessons: AvailableLesson[],
): AIEducationalAnalysis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (journal.stopLossUsagePercent >= 70) strengths.push(`Usas stop loss en el ${fmt(journal.stopLossUsagePercent, 0)} % de tus simulaciones.`);
  else weaknesses.push(`Solo el ${fmt(journal.stopLossUsagePercent, 0)} % de tus simulaciones lleva stop loss definido.`);

  if (journal.averageRiskPercent <= 2) strengths.push(`Comprometes en promedio el ${fmt(journal.averageRiskPercent, 2)} % del saldo por simulación, un tamaño contenido.`);
  else weaknesses.push(`Comprometes en promedio el ${fmt(journal.averageRiskPercent, 2)} % del saldo por simulación.`);

  if (journal.averageRiskReward != null && journal.averageRiskReward >= 1.5) {
    strengths.push(`Tu relación riesgo-beneficio media es ${fmt(journal.averageRiskReward, 2)}.`);
  } else if (journal.averageRiskReward != null) {
    weaknesses.push(`Tu relación riesgo-beneficio media es ${fmt(journal.averageRiskReward, 2)}.`);
  }

  if (journal.impulsivePercent > 20) {
    weaknesses.push(`El ${fmt(journal.impulsivePercent, 0)} % de tus simulaciones se abre menos de tres minutos después de la anterior.`);
  } else {
    strengths.push(`Solo el ${fmt(journal.impulsivePercent, 0)} % de tus simulaciones se abre de forma encadenada.`);
  }

  return {
    contextSummary: `Has registrado ${journal.totalSimulations} simulaciones. Tu porcentaje de aciertos es ${fmt(journal.hitRatePercent, 1)} %, con una muestra calificada como ${journal.sampleReliability.toLowerCase()}. Tu puntuación de disciplina es ${journal.disciplineScore} sobre 100.`,
    observedTrend:
      journal.disciplineScore >= 70
        ? 'Tu comportamiento muestra hábitos consistentes en la mayoría de las dimensiones evaluadas.'
        : journal.disciplineScore >= 45
          ? 'Tu comportamiento es irregular: algunas dimensiones están consolidadas y otras no.'
          : 'Tu comportamiento muestra margen amplio de mejora en varias dimensiones de proceso a la vez.',
    bullishEvidence: strengths.length ? strengths : ['Estás registrando tus simulaciones, que es la condición previa para poder mejorar.'],
    bearishEvidence: weaknesses.length ? weaknesses : ['No se detectan patrones problemáticos con los datos disponibles.'],
    relevantIndicators: [
      { name: 'Puntuación de disciplina', reading: `${journal.disciplineScore}/100`, interpretation: 'Combina uso de stop loss, tamaño de riesgo, relación riesgo-beneficio, registro en el diario y ausencia de impulsividad.' },
      { name: 'Uso de stop loss', reading: `${fmt(journal.stopLossUsagePercent, 0)} %`, interpretation: 'Proporción de simulaciones con límite de pérdida definido antes de abrir.' },
      { name: 'Riesgo medio por simulación', reading: `${fmt(journal.averageRiskPercent, 2)} %`, interpretation: 'Porcentaje medio del saldo virtual comprometido en cada simulación.' },
      { name: 'Apalancamiento simulado medio', reading: `${fmt(journal.averageLeverage, 1)}:1`, interpretation: 'Amplifica el efecto de cada decisión, tanto la acertada como la equivocada.' },
    ],
    risks: [
      journal.sampleReliability === 'INSUFICIENTE'
        ? 'Tu muestra es todavía pequeña: el porcentaje de aciertos que ves hoy puede cambiar sustancialmente con más repeticiones.'
        : 'Los patrones detectados describen tu comportamiento pasado. Cambiar de contexto de mercado puede alterar su validez.',
      ...journal.repeatedMistakes.slice(0, 3),
    ],
    bullishScenario: 'Si corriges el punto más débil de forma sostenida durante las próximas veinte simulaciones, la puntuación de disciplina reflejará la mejora y podrás medirla.',
    bearishScenario: 'Si intentas corregir todos los puntos a la vez, es probable que ninguno se consolide y que el diario deje de reflejar cambios reales.',
    invalidationConditions: [
      'Si tu puntuación de disciplina sube pero tus errores registrados se repiten, la puntuación no está capturando el problema real: revisa las anotaciones cualitativas.',
      'Si dejas de registrar entradas en el diario, las estadísticas dejan de ser representativas.',
    ],
    questionsForStudent: [
      '¿Cuál de los patrones señalados reconoces en tu propia experiencia?',
      '¿Qué cambio concreto podrías aplicar en tu próxima simulación, uno solo?',
      '¿En qué estado emocional tomas tus peores decisiones, según tus propias anotaciones?',
    ],
    recommendedLesson: recommendLesson(lessons, 'psicologia', 'Los patrones detectados son de conducta, no de análisis técnico.'),
    uncertaintyLevel: 'ALTA',
    sourcesUsed: ['Estadísticas agregadas de tus simulaciones registradas', 'Entradas recientes de tu diario educativo'],
    educationalDisclaimer: DISCLAIMERS.ai,
  };
}

export const DETERMINISTIC_ENGINE_ID = ENGINE_ID;
