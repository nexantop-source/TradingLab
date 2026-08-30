import { DISCLAIMERS, LEGAL_ENTITY_DESCRIPTOR, WHAT_WE_DO, WHAT_WE_DO_NOT_DO } from '@tl/types/compliance';

/**
 * Textos legales.
 *
 * Nota para el equipo: son documentos de referencia redactados para que la
 * plataforma sea funcional y coherente desde el primer día. Antes de operar
 * comercialmente deben revisarse por asesoría jurídica en cada jurisdicción de
 * destino. El versionado y el registro de consentimientos ya están
 * implementados (`LegalDocument` y `Consent`).
 */

export interface LegalDocContent {
  slug: string;
  title: string;
  version: string;
  effectiveAt: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

const REVIEW_NOTE =
  'Este documento debe ser revisado por asesoría jurídica antes de la explotación comercial en cada jurisdicción de destino.';

export const LEGAL_DOCS: LegalDocContent[] = [
  {
    slug: 'naturaleza-del-servicio',
    title: 'Naturaleza del servicio',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary:
      'Qué es y qué no es TradingLab. Es el documento más importante del centro legal y conviene leerlo antes que ningún otro.',
    sections: [
      {
        heading: '1. Descripción del servicio',
        body: `TradingLab es una ${LEGAL_ENTITY_DESCRIPTOR.toLowerCase()}. Su finalidad es exclusivamente formativa: proporcionar material educativo estructurado y un entorno de simulación con dinero virtual donde el usuario pueda practicar el análisis de mercados sin comprometer capital.`,
      },
      {
        heading: '2. Lo que TradingLab no hace',
        body: WHAT_WE_DO_NOT_DO.map((l) => `· ${l}`).join('\n'),
      },
      {
        heading: '3. Lo que TradingLab sí hace',
        body: WHAT_WE_DO.map((l) => `· ${l}`).join('\n'),
      },
      {
        heading: '4. Saldo virtual',
        body: 'Al crear una cuenta, el usuario recibe un saldo virtual de USD 10.000. Este saldo es una unidad de cuenta pedagógica sin valor económico: no es convertible, no es transferible, no puede retirarse y no representa ningún derecho de crédito frente a TradingLab ni frente a terceros. Todas las variaciones del saldo se registran en un libro mayor auditable dentro de la propia plataforma.',
      },
      {
        heading: '5. Precios y datos de mercado',
        body: `${DISCLAIMERS.prices} Cuando la serie de precios proviene del motor educativo determinístico de TradingLab y no de un mercado real, la interfaz lo indica de forma explícita mediante el distintivo de procedencia del dato.`,
      },
      {
        heading: '6. Uso del término «broker»',
        body: 'TradingLab puede emplear el término «broker» en contextos comparativos o divulgativos para explicar cómo funciona la intermediación financiera. En ningún caso debe entenderse que TradingLab sea un broker autorizado, ni que preste servicios de inversión, recepción y transmisión de órdenes, gestión de carteras o custodia de activos.',
      },
      { heading: '7. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'terminos',
    title: 'Términos y condiciones',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Condiciones de uso de la plataforma, cuenta de usuario, suscripciones y limitaciones de responsabilidad.',
    sections: [
      {
        heading: '1. Aceptación',
        body: 'El acceso y uso de TradingLab implica la aceptación de estos términos. Si no estás de acuerdo con alguno de ellos, no utilices el servicio. Registramos la versión concreta del documento que aceptaste y la fecha de aceptación.',
      },
      {
        heading: '2. Requisitos de la cuenta',
        body: 'Debes tener la mayoría de edad según la legislación de tu país de residencia y proporcionar información veraz. Cada persona puede mantener una única cuenta. Eres responsable de la confidencialidad de tus credenciales y de toda la actividad realizada desde tu cuenta.',
      },
      {
        heading: '3. Naturaleza educativa del servicio',
        body: `${DISCLAIMERS.nature} El contenido de la plataforma, incluidas las respuestas generadas por inteligencia artificial, tiene carácter exclusivamente educativo y general, no está personalizado según tu situación financiera y no constituye asesoramiento de inversión.`,
      },
      {
        heading: '4. Suscripciones y facturación',
        body: `${DISCLAIMERS.billing} Cada compra cubre un único periodo mensual o anual y no genera un cargo automático futuro. Antes de que venza te mostraremos la fecha y podrás adquirir un nuevo periodo de forma expresa. Puedes cancelar la membresía desde tu perfil; la cancelación surte efecto al final del periodo ya pagado y conservas el acceso hasta esa fecha, salvo que la transacción sea anulada por la pasarela. No aplicamos cargos ocultos ni condicionamos la cancelación a contactar con soporte.`,
      },
      {
        heading: '5. Uso aceptable',
        body: 'No está permitido: automatizar el acceso al servicio sin autorización escrita, extraer masivamente contenido o datos, revender el acceso, intentar vulnerar los controles de seguridad, usar la plataforma para promocionar productos financieros no autorizados, ni suplantar a TradingLab ante terceros.',
      },
      {
        heading: '6. Propiedad intelectual',
        body: 'El contenido educativo, el diseño, el software y las marcas de TradingLab son titularidad de TradingLab o de sus licenciantes. Se concede una licencia personal, limitada, revocable y no transferible para uso educativo. Los certificados emitidos acreditan la finalización de un itinerario formativo dentro de la plataforma y no constituyen una titulación oficial ni una habilitación profesional.',
      },
      {
        heading: '7. Limitación de responsabilidad',
        body: 'TradingLab no responde de decisiones de inversión adoptadas por el usuario en mercados reales. El servicio se presta «tal cual», sin garantía de disponibilidad ininterrumpida ni de exactitud de los datos de mercado proporcionados por terceros. En ningún caso la responsabilidad total excederá el importe abonado por el usuario en los doce meses anteriores.',
      },
      {
        heading: '8. Modificaciones',
        body: 'Podemos modificar estos términos. Los cambios sustanciales se comunican con al menos treinta días de antelación y requieren una nueva aceptación. Las versiones anteriores permanecen consultables en el centro legal.',
      },
      { heading: '9. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Qué datos tratamos, con qué finalidad, durante cuánto tiempo y qué derechos puedes ejercer.',
    sections: [
      {
        heading: '1. Datos que tratamos',
        body: '· Identificación y contacto: nombre y correo electrónico.\n· Preferencias: país, zona horaria, idioma, tema visual y accesibilidad.\n· Datos educativos: progreso, resultados de cuestionarios, certificados.\n· Datos de simulación: operaciones virtuales, diario y estadísticas derivadas.\n· Datos técnicos: agente de usuario y una versión anonimizada de la dirección IP (almacenamos únicamente un valor derivado irreversible, nunca la IP en claro).\n· Datos de facturación: gestionados por la pasarela de pagos. No almacenamos números de tarjeta.',
      },
      {
        heading: '2. Finalidades',
        body: 'Prestar el servicio educativo, personalizar la ruta formativa, medir el uso agregado del producto, prevenir el abuso y el fraude, cumplir obligaciones legales y, si lo consientes expresamente, enviarte comunicaciones educativas.',
      },
      {
        heading: '3. Inteligencia artificial',
        body: 'Cuando solicitas un análisis educativo, enviamos al proveedor del modelo únicamente el contexto de mercado necesario y el texto que tú mismo has escrito. No enviamos tu nombre, tu correo ni ningún identificador que permita reidentificarte. Las solicitudes se realizan con la opción de no retención activada cuando el proveedor lo permite.',
      },
      {
        heading: '4. Publicidad',
        body: 'La segmentación publicitaria se realiza por país, idioma, dispositivo, página, tema educativo, plan, mercado de interés y franja horaria. No utilizamos tu situación financiera, tus resultados de simulación ni tus anotaciones del diario para segmentar anuncios, y no vendemos datos personales a terceros.',
      },
      {
        heading: '5. Conservación',
        body: 'Conservamos los datos mientras la cuenta esté activa. Tras la solicitud de eliminación, los datos personales se borran o anonimizan en un plazo máximo de treinta días, salvo aquellos que debamos conservar por obligación legal (por ejemplo, registros de facturación).',
      },
      {
        heading: '6. Tus derechos',
        body: 'Puedes acceder, rectificar, suprimir, limitar y oponerte al tratamiento, así como solicitar la portabilidad de tus datos. Desde tu perfil puedes exportar tu información y solicitar la eliminación de la cuenta. También puedes escribir a privacidad@tradinglab.example.',
      },
      { heading: '7. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'cookies',
    title: 'Política de cookies',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Qué cookies usamos y cómo gestionar tu consentimiento.',
    sections: [
      {
        heading: '1. Cookies necesarias',
        body: 'Cookie de sesión (`tl_session`): mantiene tu sesión iniciada. Es httpOnly, no accesible desde JavaScript, y no puede desactivarse sin impedir el uso de la cuenta. Preferencias de tema y accesibilidad: se almacenan en el navegador y no se comparten con terceros.',
      },
      {
        heading: '2. Cookies analíticas',
        body: 'Medimos el uso agregado del producto para mejorar la experiencia educativa. Requieren tu consentimiento y puedes retirarlo en cualquier momento desde la configuración de privacidad de tu perfil.',
      },
      {
        heading: '3. Cookies publicitarias',
        body: 'Se utilizan para limitar la frecuencia con la que ves un mismo anuncio y medir su rendimiento. Requieren consentimiento. Los usuarios del plan Premium no reciben publicidad y, por tanto, no se les instalan estas cookies.',
      },
      { heading: '4. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'publicidad',
    title: 'Política publicitaria',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Reglas que rigen qué se puede anunciar en TradingLab y dónde.',
    sections: [
      {
        heading: '1. Etiquetado',
        body: 'Todo espacio comercial se identifica visiblemente como patrocinado. El etiquetado no puede ocultarse, atenuarse ni confundirse con contenido editorial. El contenido patrocinado nunca se presenta como recomendación de TradingLab.',
      },
      {
        heading: '2. Ubicaciones prohibidas',
        body: 'No se sirven anuncios: sobre el gráfico, encima de los botones de simulación, dentro del formulario de una operación, durante la confirmación de una simulación, dentro de alertas de riesgo, junto a los análisis de la inteligencia artificial, dentro de cuestionarios, ni mientras el usuario define un stop loss. Esta restricción está implementada en el servidor y no depende de la configuración de cada campaña.',
      },
      {
        heading: '3. Anunciantes excluidos',
        body: 'Se rechazan anuncios que prometan rentabilidad, garanticen resultados, oferten señales de trading, promuevan esquemas piramidales o multinivel, procedan de plataformas de inversión no verificadas, o imiten elementos de la interfaz de TradingLab. Los anunciantes del sector financiero requieren revisión manual de cumplimiento antes de activarse.',
      },
      {
        heading: '4. Segmentación',
        body: 'Se permite segmentar por país, idioma, dispositivo, página, tema educativo, plan, mercado de interés, franja horaria y campaña. Queda prohibido segmentar utilizando información financiera sensible del usuario o inferencias sobre su situación económica.',
      },
      {
        heading: '5. Patrocinio educativo',
        body: 'Un patrocinador puede asociar su marca a una ruta educativa mediante un logotipo y un mensaje institucional aprobado editorialmente. En ningún caso puede intervenir en el contenido de las lecciones, en las evaluaciones ni en las recomendaciones formativas.',
      },
      {
        heading: '6. Planes sin publicidad',
        body: 'Los usuarios del plan Premium no ven publicidad. Los del plan Standard reciben una densidad reducida y ningún interstitial.',
      },
      { heading: '7. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'riesgo',
    title: 'Advertencia de riesgo',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Los riesgos de operar en mercados reales y por qué esta plataforma no los elimina.',
    sections: [
      { heading: '1. Advertencia general', body: DISCLAIMERS.risk },
      {
        heading: '2. Instrumentos apalancados',
        body: 'Los instrumentos apalancados amplifican tanto las ganancias como las pérdidas. Una parte muy significativa de las cuentas minoristas pierde dinero operando con este tipo de productos. Antes de contratarlos con dinero real, asegúrate de comprender su funcionamiento y consulta a un profesional autorizado.',
      },
      {
        heading: '3. Limitaciones de la simulación',
        body: 'La simulación no reproduce todas las condiciones de un mercado real. En particular, no incorpora deslizamiento en momentos de alta volatilidad, huecos de apertura desfavorables, rechazos de órdenes, retrasos de ejecución ni el efecto psicológico de arriesgar dinero propio. Obtener buenos resultados en simulación no anticipa el comportamiento en un entorno real.',
      },
      {
        heading: '4. Resultados pasados',
        body: 'Los resultados históricos o simulados no representan rendimientos futuros. Ninguna estrategia, indicador o análisis puede eliminar la incertidumbre.',
      },
      { heading: '5. Revisión', body: REVIEW_NOTE },
    ],
  },
  {
    slug: 'ia',
    title: 'Uso de inteligencia artificial',
    version: '1.0.0',
    effectiveAt: '2026-01-15',
    summary: 'Cómo funciona el entrenador educativo, qué limitaciones tiene y qué controles aplicamos.',
    sections: [
      {
        heading: '1. Finalidad',
        body: 'El entrenador educativo de TradingLab es una herramienta pedagógica. No es un asesor financiero, no está autorizado para prestar servicios de inversión y no emite recomendaciones personalizadas.',
      },
      {
        heading: '2. Cómo funciona',
        body: 'El servidor obtiene los precios del proveedor de datos configurado y calcula los indicadores de forma determinística. Solo esa información ya calculada, junto con el texto que tú escribes, se envía al modelo de lenguaje. El modelo no tiene acceso a la base de datos, no puede consultar precios por su cuenta y no puede modificar el resultado de ninguna simulación.',
      },
      {
        heading: '3. Controles aplicados',
        body: '· Salida estructurada obligatoria: la respuesta debe cumplir un esquema que exige riesgos, condiciones de invalidación y nivel de incertidumbre.\n· Guardarraíles automáticos: cada respuesta se analiza antes de mostrarse para detectar órdenes imperativas, afirmaciones de certeza, promesas de rentabilidad y lecturas de indicadores no verificables.\n· Registro de versión: cada análisis almacena la versión del prompt utilizada, lo que permite auditarlo posteriormente.\n· Respaldo determinístico: si la respuesta no supera los controles, se muestra un análisis generado por el motor determinístico de la plataforma, indicando siempre qué motor lo produjo.',
      },
      {
        heading: '4. Limitaciones',
        body: 'Los modelos de lenguaje pueden cometer errores de interpretación. El análisis describe lo observable en los datos entregados y no anticipa el futuro. Trátalo como la opinión razonada de un tutor, no como una conclusión que deba aceptarse sin discutir.',
      },
      { heading: '5. Aviso', body: DISCLAIMERS.ai },
      { heading: '6. Revisión', body: REVIEW_NOTE },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDocContent | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
