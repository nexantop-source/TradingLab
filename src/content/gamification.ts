/**
 * Gamificación responsable.
 *
 * Ninguna insignia ni reto premia exclusivamente el beneficio virtual. Las
 * métricas evaluadas son de conducta y de aprendizaje. No hay cajas de
 * recompensa, giros ni mecánicas de azar.
 */

export interface BadgeSeed {
  slug: string;
  name: string;
  description: string;
  /** Identificador evaluado por `src/lib/gamification.ts`. */
  criterion: string;
  icon: string;
  category: 'DISCIPLINA' | 'APRENDIZAJE' | 'CONSISTENCIA' | 'ANALISIS';
}

export const BADGES: BadgeSeed[] = [
  {
    slug: 'primer-paso',
    name: 'Primer paso',
    description: 'Completaste tu primera lección de la academia.',
    criterion: 'LESSONS_COMPLETED>=1',
    icon: 'footprints',
    category: 'APRENDIZAJE',
  },
  {
    slug: 'hipotesis-inicial',
    name: 'Hipótesis inicial',
    description: 'Creaste tu primera simulación documentando el motivo.',
    criterion: 'SIMULATIONS>=1',
    icon: 'target',
    category: 'ANALISIS',
  },
  {
    slug: 'red-de-seguridad',
    name: 'Red de seguridad',
    description: 'Definiste stop loss en veinte simulaciones consecutivas.',
    criterion: 'STOP_LOSS_STREAK>=20',
    icon: 'shield',
    category: 'DISCIPLINA',
  },
  {
    slug: 'riesgo-medido',
    name: 'Riesgo medido',
    description: 'Mantuviste un riesgo medio por simulación igual o inferior al 2 % durante treinta operaciones.',
    criterion: 'AVG_RISK<=2&&SIMULATIONS>=30',
    icon: 'scale',
    category: 'DISCIPLINA',
  },
  {
    slug: 'asimetria',
    name: 'Asimetría',
    description: 'Alcanzaste una relación riesgo-beneficio media superior a 2 en al menos veinte simulaciones planificadas.',
    criterion: 'AVG_RR>=2&&SIMULATIONS>=20',
    icon: 'triangle',
    category: 'ANALISIS',
  },
  {
    slug: 'cronista',
    name: 'Cronista',
    description: 'Documentaste en el diario el 80 % de tus simulaciones.',
    criterion: 'JOURNAL_COVERAGE>=80',
    icon: 'notebook-pen',
    category: 'DISCIPLINA',
  },
  {
    slug: 'pulso-firme',
    name: 'Pulso firme',
    description: 'Cincuenta simulaciones sin ninguna operación impulsiva encadenada.',
    criterion: 'IMPULSIVE==0&&SIMULATIONS>=50',
    icon: 'hand',
    category: 'DISCIPLINA',
  },
  {
    slug: 'constancia',
    name: 'Constancia',
    description: 'Catorce días consecutivos con actividad educativa.',
    criterion: 'STREAK>=14',
    icon: 'flame',
    category: 'CONSISTENCIA',
  },
  {
    slug: 'ruta-completada',
    name: 'Ruta completada',
    description: 'Completaste una ruta educativa entera y superaste su evaluación final.',
    criterion: 'TRACKS_COMPLETED>=1',
    icon: 'graduation-cap',
    category: 'APRENDIZAJE',
  },
  {
    slug: 'lector-critico',
    name: 'Lector crítico',
    description: 'Superaste diez cuestionarios con una puntuación igual o superior al 90 %.',
    criterion: 'QUIZ_HIGH_SCORES>=10',
    icon: 'book-check',
    category: 'APRENDIZAJE',
  },
  {
    slug: 'revision-honesta',
    name: 'Revisión honesta',
    description: 'Solicitaste una revisión posterior del entrenador en veinte simulaciones cerradas.',
    criterion: 'POST_TRADE_REVIEWS>=20',
    icon: 'search-check',
    category: 'ANALISIS',
  },
  {
    slug: 'plan-cumplido',
    name: 'Plan cumplido',
    description: 'Cerraste diez simulaciones seguidas sin mover el stop loss en contra.',
    criterion: 'PLAN_RESPECTED>=10',
    icon: 'check-check',
    category: 'DISCIPLINA',
  },
];

export interface ChallengeSeed {
  slug: string;
  title: string;
  description: string;
  /** Métrica evaluada. Nunca es únicamente el beneficio virtual. */
  metric: string;
  target: number;
  xpReward: number;
  durationDays: number;
  visibility: 'PUBLIC' | 'PRIVATE';
  minPlan: 'FREE' | 'STANDARD' | 'PREMIUM';
}

export const CHALLENGES: ChallengeSeed[] = [
  {
    slug: 'semana-con-stop-loss',
    title: 'Una semana con stop loss',
    description:
      'Abre al menos diez simulaciones esta semana y define stop loss en todas. La métrica es el porcentaje de cobertura, no el resultado.',
    metric: 'STOP_LOSS_COVERAGE',
    target: 100,
    xpReward: 120,
    durationDays: 7,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'diario-completo',
    title: 'Diario completo',
    description: 'Documenta en el diario todas las simulaciones que cierres durante quince días.',
    metric: 'JOURNAL_COVERAGE',
    target: 100,
    xpReward: 150,
    durationDays: 15,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'riesgo-bajo-control',
    title: 'Riesgo bajo control',
    description:
      'Mantén el riesgo medio por simulación por debajo del 1,5 % del saldo virtual durante veinte operaciones.',
    metric: 'AVG_RISK_PERCENT',
    target: 1.5,
    xpReward: 200,
    durationDays: 30,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'sin-impulsos',
    title: 'Sin impulsos',
    description:
      'Treinta días sin abrir dos simulaciones con menos de tres minutos de diferencia. Se mide la pausa entre decisiones.',
    metric: 'IMPULSIVE_COUNT',
    target: 0,
    xpReward: 180,
    durationDays: 30,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'ruta-fundamentos',
    title: 'Fundamentos en dos semanas',
    description: 'Completa la ruta «Mercados financieros desde cero» y supera todos sus cuestionarios.',
    metric: 'TRACK_PROGRESS',
    target: 100,
    xpReward: 250,
    durationDays: 14,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'calidad-del-analisis',
    title: 'Calidad del análisis',
    description:
      'Escribe un motivo de al menos 200 caracteres en quince simulaciones consecutivas. Se evalúa el razonamiento, no el acierto.',
    metric: 'RATIONALE_QUALITY',
    target: 15,
    xpReward: 160,
    durationDays: 21,
    visibility: 'PUBLIC',
    minPlan: 'FREE',
  },
  {
    slug: 'estrategia-consistente',
    title: 'Estrategia consistente',
    description:
      'Aplica una misma estrategia etiquetada en treinta simulaciones sin modificar sus reglas, y revisa el resultado agregado.',
    metric: 'STRATEGY_CONSISTENCY',
    target: 30,
    xpReward: 300,
    durationDays: 45,
    visibility: 'PRIVATE',
    minPlan: 'PREMIUM',
  },
];

/** Umbrales de nivel. La experiencia se gana por aprendizaje y disciplina. */
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 900, 1500, 2400, 3600, 5200, 7200, 10000];

export function levelFromXp(xp: number): { level: number; current: number; next: number | null } {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  return {
    level,
    current: LEVEL_THRESHOLDS[level - 1] ?? 0,
    next: LEVEL_THRESHOLDS[level] ?? null,
  };
}

/** Experiencia otorgada por acción. Ninguna depende del beneficio virtual. */
export const XP_REWARDS = {
  LESSON_COMPLETED: 25,
  QUIZ_PASSED: 15,
  QUIZ_PERFECT: 25,
  JOURNAL_ENTRY: 10,
  SIMULATION_WITH_STOP_LOSS: 5,
  SIMULATION_WITH_RATIONALE: 5,
  POST_TRADE_REVIEW: 8,
  TRACK_COMPLETED: 150,
  DAILY_STREAK: 5,
} as const;
