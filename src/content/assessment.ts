import type { ExperienceLevel } from '@tl/types';

/**
 * Evaluación inicial del onboarding.
 *
 * Ocho preguntas que no miden «cuánto sabes de trading» sino qué comprensión
 * tienes del riesgo y de la naturaleza del producto. La clasificación
 * resultante determina la ruta educativa recomendada.
 */

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  options: Array<{ label: string; points: number }>;
  /** Explicación que se muestra al terminar la evaluación. */
  rationale: string;
}

export const ASSESSMENT: AssessmentQuestion[] = [
  {
    id: 'a1',
    prompt: 'Si una operación pierde el 50 % del capital, ¿cuánto hay que ganar sobre lo que queda para volver al punto de partida?',
    options: [
      { label: 'Un 50 %', points: 0 },
      { label: 'Un 75 %', points: 1 },
      { label: 'Un 100 %', points: 3 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'Las pérdidas y las ganancias no son simétricas: recuperar una caída del 50 % exige duplicar lo restante. Por eso limitar el daño importa más que maximizar la ganancia.',
  },
  {
    id: 'a2',
    prompt: '¿Qué es un stop loss?',
    options: [
      { label: 'Una comisión que cobra la plataforma', points: 0 },
      { label: 'Un nivel de precio donde se cierra la posición para limitar la pérdida', points: 3 },
      { label: 'Una garantía de no perder dinero', points: 0 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'El stop loss limita la pérdida, pero no la elimina: en mercados con huecos de precio la ejecución puede producirse peor que el nivel definido.',
  },
  {
    id: 'a3',
    prompt: 'El apalancamiento 1:100 significa que...',
    options: [
      { label: 'Ganarás cien veces más', points: 0 },
      { label: 'Controlas una posición cien veces mayor que tu garantía', points: 3 },
      { label: 'Tienes cien veces menos riesgo', points: 0 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'El apalancamiento amplía el tamaño de la posición. No mejora la calidad de la decisión: solo aumenta el coste de equivocarse.',
  },
  {
    id: 'a4',
    prompt: 'Un porcentaje de aciertos del 70 % en diez operaciones indica que...',
    options: [
      { label: 'La estrategia es buena', points: 0 },
      { label: 'La muestra es demasiado pequeña para concluir nada', points: 3 },
      { label: 'Hay que aumentar el tamaño de las posiciones', points: 0 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'Con diez operaciones no se distingue habilidad de suerte. Por eso la plataforma muestra siempre el tamaño de muestra junto al porcentaje de aciertos.',
  },
  {
    id: 'a5',
    prompt: 'El RSI marca 78. ¿Qué significa?',
    options: [
      { label: 'Que el precio va a bajar', points: 0 },
      { label: 'Que las subidas recientes han sido intensas respecto a las bajadas', points: 3 },
      { label: 'Que hay que vender', points: 0 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'Sobrecompra no equivale a giro inminente. En tendencias fuertes el RSI puede permanecer alto durante semanas.',
  },
  {
    id: 'a6',
    prompt: 'Alguien te ofrece una rentabilidad fija del 15 % mensual sin riesgo. ¿Qué haces?',
    options: [
      { label: 'Invierto una cantidad pequeña para probar', points: 0 },
      { label: 'Verifico el registro de la entidad en el organismo supervisor y, ante la promesa, descarto', points: 3 },
      { label: 'Pido referencias a quien me lo ofrece', points: 1 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'Una rentabilidad fija, alta y sin riesgo no existe en mercados reales. Es la señal de fraude más clara que hay.',
  },
  {
    id: 'a7',
    prompt: '¿Qué porcentaje del capital consideras razonable arriesgar en una sola operación?',
    options: [
      { label: 'Entre el 1 % y el 2 %', points: 3 },
      { label: 'Alrededor del 10 %', points: 1 },
      { label: 'El 25 % o más, para que valga la pena', points: 0 },
      { label: 'No lo sé', points: 0 },
    ],
    rationale:
      'No hay una cifra mágica, pero con un 1 % por operación diez pérdidas seguidas dejan cerca del 90 % del capital; con un 25 %, lo dejan prácticamente agotado.',
  },
  {
    id: 'a8',
    prompt: '¿Qué esperas de esta plataforma?',
    options: [
      { label: 'Aprender a analizar mercados y practicar sin arriesgar dinero', points: 3 },
      { label: 'Recibir señales de compra y venta', points: 0 },
      { label: 'Obtener ingresos con el saldo virtual', points: 0 },
      { label: 'Todavía no lo tengo claro', points: 1 },
    ],
    rationale:
      'TradingLab es educativa y de simulación. No emite señales, no promete rentabilidad y el saldo virtual no es convertible ni retirable.',
  },
];

export const MAX_ASSESSMENT_SCORE = ASSESSMENT.reduce(
  (a, q) => a + Math.max(...q.options.map((o) => o.points)),
  0,
);

export function classify(score: number): {
  level: ExperienceLevel;
  headline: string;
  recommendation: string;
  recommendedTrack: string;
} {
  const pct = (score / MAX_ASSESSMENT_SCORE) * 100;

  if (pct < 30) {
    return {
      level: 'PRINCIPIANTE',
      headline: 'Empezamos por los cimientos',
      recommendation:
        'Vas a construir la base desde cero: qué es un mercado, cómo se forma un precio y por qué el riesgo es la primera decisión, no la última. No hace falta ningún conocimiento previo.',
      recommendedTrack: 'mercados-desde-cero',
    };
  }
  if (pct < 55) {
    return {
      level: 'EXPLORADOR',
      headline: 'Tienes nociones sueltas: vamos a ordenarlas',
      recommendation:
        'Reconoces algunos conceptos, pero conviene consolidar la lectura de gráficos y, sobre todo, la gestión del riesgo antes de avanzar a herramientas más complejas.',
      recommendedTrack: 'lectura-de-graficos',
    };
  }
  if (pct < 80) {
    return {
      level: 'INTERMEDIO',
      headline: 'Base sólida, toca sistematizar',
      recommendation:
        'Manejas los conceptos centrales. El siguiente salto no está en aprender más indicadores, sino en convertir tus ideas en reglas explícitas y medibles.',
      recommendedTrack: 'gestion-del-riesgo',
    };
  }
  return {
    level: 'AVANZADO',
    headline: 'Conocimiento consolidado',
    recommendation:
      'Comprendes bien el riesgo y la naturaleza estadística del proceso. Te recomendamos empezar por diseño de estrategias y backtesting, y usar el diario para detectar sesgos residuales.',
    recommendedTrack: 'creacion-de-estrategias',
  };
}

/** Opciones del formulario de onboarding. */
export const EDUCATIONAL_GOALS = [
  { value: 'entender-mercados', label: 'Entender cómo funcionan los mercados' },
  { value: 'analisis-tecnico', label: 'Aprender análisis técnico' },
  { value: 'gestion-riesgo', label: 'Mejorar mi gestión del riesgo' },
  { value: 'disciplina', label: 'Ganar disciplina y consistencia' },
  { value: 'estrategia', label: 'Construir mi propia estrategia' },
  { value: 'evitar-fraudes', label: 'Aprender a reconocer fraudes financieros' },
] as const;

export const WEEKLY_AVAILABILITY = [
  { value: 1, label: 'Menos de 2 horas por semana' },
  { value: 3, label: 'Entre 2 y 4 horas' },
  { value: 6, label: 'Entre 5 y 8 horas' },
  { value: 12, label: 'Más de 8 horas' },
] as const;
