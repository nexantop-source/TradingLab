/**
 * Catálogo de eventos de producto.
 *
 * Un único lugar donde se declara qué se mide. Nada de cadenas sueltas por el
 * código: eso es lo que hace inservible una analítica a los seis meses.
 *
 * Regla de privacidad: las propiedades nunca contienen datos personales ni
 * importes reales. El saldo virtual sí puede registrarse porque no es dinero.
 */

export const ANALYTICS_EVENTS = {
  // Adquisición
  LANDING_VIEW: 'landing_view',
  SIGNUP_STARTED: 'signup_started',
  SIGNUP_COMPLETED: 'signup_completed',
  LOGIN: 'login',

  // Activación
  ONBOARDING_STEP: 'onboarding_step',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  ASSESSMENT_COMPLETED: 'assessment_completed',
  DEMO_ACCOUNT_CREATED: 'demo_account_created',
  FIRST_LESSON_COMPLETED: 'first_lesson_completed',
  FIRST_SIMULATION_CREATED: 'first_simulation_created',

  // Compromiso
  LESSON_STARTED: 'lesson_started',
  LESSON_COMPLETED: 'lesson_completed',
  QUIZ_ATTEMPTED: 'quiz_attempted',
  QUIZ_PASSED: 'quiz_passed',
  CERTIFICATE_ISSUED: 'certificate_issued',
  SIMULATION_CREATED: 'simulation_created',
  SIMULATION_CLOSED: 'simulation_closed',
  JOURNAL_ENTRY_CREATED: 'journal_entry_created',
  AI_ANALYSIS_REQUESTED: 'ai_analysis_requested',
  AI_ANALYSIS_RATED: 'ai_analysis_rated',
  ALERT_CREATED: 'alert_created',
  CHALLENGE_JOINED: 'challenge_joined',
  WATCHLIST_UPDATED: 'watchlist_updated',
  BALANCE_RESET: 'balance_reset',

  // Monetización
  PRICING_VIEW: 'pricing_view',
  PAYWALL_VIEW: 'paywall_view',
  CHECKOUT_STARTED: 'checkout_started',
  SUBSCRIPTION_STARTED: 'subscription_started',
  TRIAL_STARTED: 'trial_started',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  PLAN_LIMIT_REACHED: 'plan_limit_reached',

  // Publicidad
  AD_IMPRESSION: 'ad_impression',
  AD_CLICK: 'ad_click',
  AD_NO_FILL: 'ad_no_fill',

  // Calidad
  DATA_PROVIDER_DEGRADED: 'data_provider_degraded',
  AI_GUARDRAIL_TRIGGERED: 'ai_guardrail_triggered',
  ERROR_SHOWN: 'error_shown',
} as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * Métricas del negocio. El panel de analítica se construye sobre esta lista.
 * `northStar` marca la métrica principal, que deliberadamente no es la
 * rentabilidad virtual del estudiante.
 */
export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  unit: 'count' | 'percent' | 'usd' | 'ratio' | 'ms';
  category: 'adquisicion' | 'activacion' | 'retencion' | 'ingresos' | 'costes' | 'educacion' | 'publicidad' | 'calidad';
  northStar?: boolean;
}

export const METRICS: MetricDefinition[] = [
  { key: 'signups', label: 'Registros', description: 'Cuentas creadas en el periodo.', unit: 'count', category: 'adquisicion' },
  { key: 'activation_rate', label: 'Activación', description: 'Porcentaje de registros que completa onboarding, primera lección y primera simulación.', unit: 'percent', category: 'activacion', northStar: true },
  { key: 'first_lesson_rate', label: 'Primera lección completada', description: 'Porcentaje de registros que completa al menos una lección.', unit: 'percent', category: 'activacion' },
  { key: 'first_simulation_rate', label: 'Primera simulación', description: 'Porcentaje de registros que crea al menos una simulación.', unit: 'percent', category: 'activacion' },
  { key: 'dau', label: 'Usuarios activos diarios', description: 'Usuarios con actividad en el día.', unit: 'count', category: 'retencion' },
  { key: 'mau', label: 'Usuarios activos mensuales', description: 'Usuarios con actividad en el mes.', unit: 'count', category: 'retencion' },
  { key: 'retention_d1', label: 'Retención D1', description: 'Vuelven al día siguiente del registro.', unit: 'percent', category: 'retencion' },
  { key: 'retention_d7', label: 'Retención D7', description: 'Vuelven siete días después del registro.', unit: 'percent', category: 'retencion' },
  { key: 'retention_d30', label: 'Retención D30', description: 'Vuelven treinta días después del registro.', unit: 'percent', category: 'retencion' },
  { key: 'conversion_free_standard', label: 'Conversión Free → Standard', description: 'Porcentaje de usuarios Free que contrata Standard.', unit: 'percent', category: 'ingresos' },
  { key: 'conversion_free_premium', label: 'Conversión Free → Premium', description: 'Porcentaje de usuarios Free que contrata Premium.', unit: 'percent', category: 'ingresos' },
  { key: 'mrr', label: 'MRR', description: 'Ingreso recurrente mensual de suscripciones.', unit: 'usd', category: 'ingresos' },
  { key: 'arr', label: 'ARR', description: 'Ingreso recurrente anualizado.', unit: 'usd', category: 'ingresos' },
  { key: 'churn', label: 'Churn mensual', description: 'Porcentaje de suscriptores que cancela en el mes.', unit: 'percent', category: 'ingresos' },
  { key: 'arpu', label: 'ARPU', description: 'Ingreso medio por usuario activo.', unit: 'usd', category: 'ingresos' },
  { key: 'ltv', label: 'LTV', description: 'Valor estimado de vida del cliente.', unit: 'usd', category: 'ingresos' },
  { key: 'cac', label: 'CAC', description: 'Coste de adquisición por cliente de pago.', unit: 'usd', category: 'ingresos' },
  { key: 'ai_calls', label: 'Llamadas a IA', description: 'Análisis educativos generados.', unit: 'count', category: 'costes' },
  { key: 'ai_cost_per_user', label: 'Coste de IA por usuario', description: 'Coste medio mensual de inferencia por usuario activo.', unit: 'usd', category: 'costes' },
  { key: 'data_cost_per_user', label: 'Coste de datos por usuario', description: 'Coste medio mensual del proveedor de mercado por usuario activo.', unit: 'usd', category: 'costes' },
  { key: 'course_completion', label: 'Finalización de cursos', description: 'Porcentaje de cursos iniciados que se completan.', unit: 'percent', category: 'educacion' },
  { key: 'quiz_improvement', label: 'Mejora en evaluaciones', description: 'Variación media de puntuación entre el primer y el último intento.', unit: 'percent', category: 'educacion' },
  { key: 'journal_coverage', label: 'Simulaciones con diario', description: 'Porcentaje de simulaciones documentadas en el diario.', unit: 'percent', category: 'educacion' },
  { key: 'discipline_score_avg', label: 'Puntuación media de disciplina', description: 'Media de la puntuación de disciplina de los estudiantes activos.', unit: 'ratio', category: 'educacion' },
  { key: 'ad_revenue', label: 'Ingresos publicitarios', description: 'Ingreso reconocido por publicidad en el periodo.', unit: 'usd', category: 'publicidad' },
  { key: 'ecpm', label: 'eCPM', description: 'Ingreso por cada mil impresiones servidas.', unit: 'usd', category: 'publicidad' },
  { key: 'fill_rate', label: 'Fill rate', description: 'Porcentaje de solicitudes de anuncio que se sirven.', unit: 'percent', category: 'publicidad' },
  { key: 'viewability', label: 'Viewability', description: 'Porcentaje de impresiones efectivamente visibles.', unit: 'percent', category: 'publicidad' },
  { key: 'arpu_free', label: 'Ingreso por usuario Free', description: 'Ingreso publicitario medio por usuario del plan Free.', unit: 'usd', category: 'publicidad' },
  { key: 'support_tickets', label: 'Tickets de soporte', description: 'Solicitudes abiertas en el periodo.', unit: 'count', category: 'calidad' },
  { key: 'error_rate', label: 'Tasa de error', description: 'Errores de servidor por cada mil solicitudes.', unit: 'ratio', category: 'calidad' },
  { key: 'p95_latency', label: 'Latencia p95', description: 'Percentil 95 del tiempo de respuesta de la API.', unit: 'ms', category: 'calidad' },
];

export const NORTH_STAR = METRICS.find((m) => m.northStar)!;
