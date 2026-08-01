/**
 * Textos legales y de cumplimiento reutilizados en toda la plataforma.
 *
 * Centralizarlos garantiza que el mismo mensaje aparezca en onboarding, pie de
 * página, confirmación de simulación, pagos y respuestas de la IA, y que una
 * revisión de cumplimiento tenga un único archivo que auditar.
 */

export const LEGAL_ENTITY_DESCRIPTOR = 'Plataforma educativa de análisis y simulación de mercados financieros';

export const DISCLAIMERS = {
  /** Aviso corto, para píldoras y encabezados. */
  short: '100% simulación educativa',

  /** Aviso junto al saldo. Criterio de aceptación #2. */
  balance: 'Saldo virtual DEMO. No es dinero real y no puede retirarse.',

  /** Aviso obligatorio antes de confirmar cualquier simulación. */
  beforeSimulation:
    'Esta es una simulación educativa con dinero virtual. No se ejecuta ninguna orden en un mercado real, no se compromete capital y el resultado no representa una ganancia ni una pérdida real.',

  /** Aviso al pie de cada análisis de la IA. */
  ai: 'Este análisis es material educativo generado automáticamente. No es una recomendación de inversión ni asesoramiento financiero personalizado. Ningún escenario descrito tiene garantía de cumplirse.',

  /** Aviso de riesgo del pie de página. */
  risk: 'Operar en mercados financieros reales implica riesgo de pérdida, incluida la pérdida total del capital. Los resultados históricos o simulados no representan rendimientos futuros. Antes de contratar cualquier producto financiero real, consulta a un profesional autorizado en tu jurisdicción.',

  /** Aviso de naturaleza del servicio, para pie de página y pagos. */
  nature: `${LEGAL_ENTITY_DESCRIPTOR}. TradingLab no es un broker regulado, no recibe dinero para inversión, no admite depósitos de capital de trading, no permite retiros de utilidades, no custodia fondos ni activos, no ejecuta órdenes en mercados reales y no conecta al usuario con mercados para invertir.`,

  /** Aviso sobre la naturaleza de los precios mostrados. */
  prices:
    'Los precios se muestran exclusivamente con fines educativos. Consulta siempre la fuente y la latencia indicadas junto al gráfico.',

  /** Aviso de suscripción, mostrado en el checkout. */
  billing:
    'La suscripción da acceso a contenido educativo y a herramientas de simulación. No otorga acceso a mercados reales, no constituye una inversión y no genera rendimiento alguno.',

  /** Etiqueta obligatoria de todo espacio comercial. */
  ad: 'Contenido patrocinado. La plataforma no recomienda ni respalda los productos anunciados.',
} as const;

/** Enumeración explícita de lo que la plataforma NO hace. Se muestra en /legal/naturaleza-del-servicio. */
export const WHAT_WE_DO_NOT_DO: string[] = [
  'No somos un broker regulado ni una entidad autorizada para intermediar inversiones.',
  'No recibimos dinero destinado a inversión.',
  'No admitimos depósitos de capital de trading.',
  'No permitimos retirar utilidades: el saldo DEMO no es convertible.',
  'No custodiamos fondos ni activos de ningún tipo.',
  'No ejecutamos órdenes en mercados reales.',
  'No conectamos al usuario con mercados para invertir.',
  'No prometemos rentabilidad.',
  'No garantizamos resultados.',
  'No ofrecemos asesoramiento financiero personalizado.',
];

export const WHAT_WE_DO: string[] = [
  'Enseñamos cómo funcionan los mercados financieros con material estructurado.',
  'Entregamos una cuenta DEMO con USD 10.000 virtuales para practicar.',
  'Mostramos precios y gráficos con su fuente y latencia siempre visibles.',
  'Permitimos simular operaciones sin arriesgar dinero.',
  'Explicamos con inteligencia artificial qué ocurrió y por qué, en términos educativos.',
  'Registramos un diario de aprendizaje para revisar decisiones.',
  'Evaluamos la comprensión con cuestionarios y certificados educativos.',
];

/**
 * Expresiones prohibidas en cualquier texto de producto, marketing, IA o
 * publicidad. `packages/ai/guardrails.ts` y la revisión de creatividades
 * publicitarias usan esta lista.
 */
export const FORBIDDEN_CLAIMS: string[] = [
  'ganancia segura',
  'ganancias seguras',
  'señal garantizada',
  'señales garantizadas',
  'rentabilidad asegurada',
  'rentabilidad garantizada',
  'dinero fácil',
  'hazte rico',
  'sin riesgo',
  'riesgo cero',
  'beneficio garantizado',
  'retorno garantizado',
  'gana siempre',
  'nunca pierdas',
  'duplica tu dinero',
  '100% de aciertos',
  'método infalible',
  'te lo aseguro',
  'inversión segura',
];

/** Conductas que la IA nunca debe adoptar. Se inyectan en el prompt de sistema. */
export const AI_PROHIBITED_BEHAVIORS: string[] = [
  'Garantizar resultados o afirmar que una operación será exitosa.',
  'Afirmar que conoce el futuro del precio.',
  'Dar una orden imperativa de compra o venta ("compra", "vende", "entra ahora").',
  'Inventar precios, cotizaciones o niveles no incluidos en el contexto entregado.',
  'Inventar noticias, hechos o fuentes.',
  'Inventar valores de indicadores: solo puede citar los que recibe calculados.',
  'Presentar una probabilidad como certeza.',
  'Recomendar endeudarse para operar.',
  'Recomendar usar dinero necesario para gastos personales.',
  'Incentivar recuperar pérdidas operando más.',
  'Recomendar aumentar el riesgo después de una pérdida.',
  'Presentarse como asesor financiero autorizado.',
  'Recomendar plataformas de inversión no verificadas.',
];

export const LEGAL_DOCUMENTS = [
  { slug: 'terminos', title: 'Términos y condiciones', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'privacidad', title: 'Política de privacidad', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'cookies', title: 'Política de cookies', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'publicidad', title: 'Política publicitaria', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'riesgo', title: 'Advertencia de riesgo', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'naturaleza-del-servicio', title: 'Naturaleza del servicio', version: '1.0.0', effective: '2026-01-15' },
  { slug: 'ia', title: 'Uso de inteligencia artificial', version: '1.0.0', effective: '2026-01-15' },
] as const;

export type LegalDocSlug = (typeof LEGAL_DOCUMENTS)[number]['slug'];
