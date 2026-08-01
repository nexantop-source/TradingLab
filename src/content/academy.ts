import type { LessonBlock, QuizQuestion, TrackLevel } from '@tl/types';

/**
 * Contenido de la academia.
 *
 * Vive en código para que el repositorio arranque con material real y para que
 * el control de versiones registre los cambios editoriales. El CMS del panel
 * administrativo escribe sobre las mismas tablas: la semilla carga esto y a
 * partir de ahí el contenido se edita desde `/admin/contenido`.
 */

export interface LessonSeed {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
  minPlan: 'FREE' | 'STANDARD' | 'PREMIUM';
  requiresSimulation?: boolean;
  topic: string;
  blocks: LessonBlock[];
  quiz?: { questions: QuizQuestion[]; passingScore?: number };
}

export interface ModuleSeed {
  slug: string;
  title: string;
  lessons: LessonSeed[];
}

export interface CourseSeed {
  slug: string;
  title: string;
  summary: string;
  minPlan: 'FREE' | 'STANDARD' | 'PREMIUM';
  modules: ModuleSeed[];
}

export interface TrackSeed {
  slug: string;
  title: string;
  summary: string;
  level: TrackLevel;
  topic: string;
  icon: string;
  minPlan: 'FREE' | 'STANDARD' | 'PREMIUM';
  courses: CourseSeed[];
}

const q = (
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string,
): QuizQuestion => ({ id, prompt, options, correctIndex, explanation });

export const TRACKS: TrackSeed[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'mercados-desde-cero',
    title: 'Mercados financieros desde cero',
    summary: 'Qué es un mercado, quién participa, cómo se forma un precio y por qué se mueve.',
    level: 'BASICO',
    topic: 'fundamentos',
    icon: 'compass',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'fundamentos-del-mercado',
        title: 'Fundamentos del mercado',
        summary: 'La base conceptual sobre la que se apoya todo lo demás.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'que-es-un-mercado',
            title: 'Qué es un mercado',
            lessons: [
              {
                slug: 'que-es-un-mercado-financiero',
                title: 'Qué es un mercado financiero',
                summary: 'Un lugar donde se intercambian activos y donde el precio es el resultado de un acuerdo, no una verdad.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'fundamentos',
                blocks: [
                  {
                    type: 'text',
                    body: 'Un mercado financiero es un mecanismo donde compradores y vendedores acuerdan el precio de un activo. No hay un precio «correcto» esperando ser descubierto: hay un precio al que, en este instante, alguien está dispuesto a vender y otra persona está dispuesta a comprar.\n\nEsa distinción es más importante de lo que parece. Si asumes que el precio refleja el valor verdadero, cada movimiento te parecerá información. Si asumes que el precio es solo el punto donde se cruzan dos opiniones, entenderás por qué se mueve tanto sin que cambie nada del activo subyacente.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'Precio no es valor',
                    body: 'El precio es lo que se paga hoy. El valor es una estimación de lo que algo debería costar. Toda la industria financiera vive en la diferencia entre ambos, y nadie tiene la respuesta definitiva.',
                  },
                  {
                    type: 'text',
                    title: 'Quién participa',
                    body: 'En un mercado conviven participantes con objetivos incompatibles: quien cubre un riesgo, quien busca rentabilidad, quien provee liquidez a cambio de un margen, quien ejecuta una decisión institucional planificada hace meses y quien reacciona a un titular.\n\nCuando una operación te sorprende, suele ser porque el otro lado tenía un objetivo distinto del tuyo, no porque «el mercado sea irracional».',
                  },
                  {
                    type: 'example',
                    title: 'Un ejemplo cotidiano',
                    body: 'Una aerolínea compra petróleo a futuro no porque crea que subirá, sino porque necesita saber cuánto le costará el combustible el año que viene. Está pagando por certidumbre, no apostando por una dirección. Su orden mueve el precio igual que la de un especulador, pero por una razón completamente distinta.',
                  },
                  {
                    type: 'checklist',
                    title: 'Ideas que deberías poder explicar con tus palabras',
                    body: '',
                    items: [
                      'Por qué el precio no equivale al valor.',
                      'Al menos tres tipos de participante con objetivos distintos.',
                      'Por qué un mismo movimiento puede tener causas opuestas.',
                    ],
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Qué representa el precio de un activo en un momento dado?',
                      [
                        'El valor real y objetivo del activo.',
                        'El punto donde un comprador y un vendedor acuerdan intercambiar.',
                        'Una predicción del precio futuro elaborada por el mercado.',
                        'El coste de producción del activo.',
                      ],
                      1,
                      'El precio es el resultado de un acuerdo entre dos partes en un instante concreto. El valor es una estimación distinta, y no tienen por qué coincidir.',
                    ),
                    q(
                      'q2',
                      'Una aerolínea compra petróleo a futuro. ¿Cuál es su objetivo más probable?',
                      [
                        'Especular con la subida del crudo.',
                        'Fijar el coste futuro de su combustible y reducir incertidumbre.',
                        'Manipular el precio del petróleo.',
                        'Obtener dividendos del contrato.',
                      ],
                      1,
                      'Es una operación de cobertura: paga por certidumbre, no por dirección.',
                    ),
                    q(
                      'q3',
                      '¿Por qué puede subir el precio de un activo sin que mejore nada de ese activo?',
                      [
                        'Porque el mercado se equivoca y luego se corrige siempre.',
                        'Porque los participantes actúan por motivos distintos, incluidos los ajenos al activo.',
                        'Porque los precios son aleatorios y no tienen causa.',
                        'Porque los reguladores lo permiten.',
                      ],
                      1,
                      'Coberturas, rebalanceos, flujos de fondos o simple liquidez pueden mover un precio sin que cambie nada del activo en sí.',
                    ),
                  ],
                },
              },
              {
                slug: 'oferta-demanda-y-liquidez',
                title: 'Oferta, demanda y liquidez',
                summary: 'Por qué el mismo movimiento cuesta más caro en un mercado poco líquido.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'fundamentos',
                blocks: [
                  {
                    type: 'text',
                    body: 'La liquidez mide con qué facilidad puedes entrar o salir de una posición sin mover el precio en tu contra. Un mercado muy líquido absorbe órdenes grandes sin inmutarse; uno poco líquido se desplaza con poco volumen.\n\nEsto tiene una consecuencia práctica inmediata: el mismo análisis técnico aplicado a un par de divisas principal y a un criptoactivo pequeño produce resultados muy distintos, no porque el análisis falle, sino porque el coste de ejecutarlo es diferente.',
                  },
                  {
                    type: 'text',
                    title: 'El spread es el precio de la liquidez',
                    body: 'La diferencia entre el precio al que puedes comprar (ask) y aquel al que puedes vender (bid) se llama spread. Es la remuneración de quien provee liquidez y, para ti, un coste que pagas dos veces: al abrir y al cerrar.\n\nEn la terminal de TradingLab cada instrumento tiene un spread virtual distinto, calibrado según su liquidez real: verás que operar EUR/USD cuesta mucho menos que operar un criptoactivo pequeño.',
                  },
                  {
                    type: 'example',
                    title: 'Cálculo del coste',
                    body: 'Si el EUR/USD cotiza con un spread de 1,2 puntos básicos y abres una posición de USD 10.000 virtuales, el coste de apertura ronda los USD 0,60. Si haces cuarenta operaciones al día, ese coste aparentemente irrelevante se convierte en USD 48 diarios. La frecuencia convierte costes pequeños en costes decisivos.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Abre la terminal, selecciona EUR/USD y anota el bid y el ask. Repite con SOL/USD. Calcula el spread relativo de cada uno (diferencia dividida entre el precio medio) y compáralos. ¿Cuántas veces más caro es entrar en el segundo?',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Qué es el spread?',
                      [
                        'La comisión que cobra el regulador.',
                        'La diferencia entre el precio de compra y el de venta.',
                        'La variación diaria del precio.',
                        'El impuesto sobre las operaciones financieras.',
                      ],
                      1,
                      'El spread es la diferencia entre bid y ask, y funciona como coste de transacción implícito.',
                    ),
                    q(
                      'q2',
                      'Un mercado poco líquido implica que...',
                      [
                        'El precio se mueve menos ante una orden grande.',
                        'El precio se mueve más ante una orden grande y el spread suele ser mayor.',
                        'No hay riesgo de pérdida.',
                        'Los indicadores técnicos funcionan mejor.',
                      ],
                      1,
                      'Menos liquidez significa que hace falta menos volumen para desplazar el precio, y que el coste de entrar y salir es mayor.',
                    ),
                    q(
                      'q3',
                      'Operas cuarenta veces al día con un coste de USD 0,60 por operación. ¿Cuánto pagas al mes, aproximadamente, con veinte días hábiles?',
                      ['USD 24', 'USD 240', 'USD 480', 'USD 4.800'],
                      2,
                      '40 × 0,60 = USD 24 al día; 24 × 20 = USD 480 al mes. La frecuencia amplifica los costes.',
                    ),
                  ],
                },
              },
              {
                slug: 'como-leer-una-cotizacion',
                title: 'Cómo leer una cotización',
                summary: 'Bid, ask, último precio, variación, máximo y mínimo del día: qué te dice cada campo.',
                estimatedMinutes: 7,
                minPlan: 'FREE',
                topic: 'fundamentos',
                requiresSimulation: false,
                blocks: [
                  {
                    type: 'text',
                    body: 'Una cotización condensa mucha información en pocos números. Vale la pena leerlos despacio una vez para no volver a confundirlos nunca.',
                  },
                  {
                    type: 'checklist',
                    title: 'Los campos y su significado',
                    body: '',
                    items: [
                      'Bid: el precio al que puedes vender ahora mismo.',
                      'Ask: el precio al que puedes comprar ahora mismo. Siempre mayor que el bid.',
                      'Último: el precio de la última operación cruzada.',
                      'Variación: diferencia respecto al cierre de la sesión anterior, no respecto a cuando abriste el gráfico.',
                      'Máximo y mínimo del día: el rango recorrido desde la apertura de la sesión.',
                      'Volumen: cuánto se ha negociado en el periodo.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'La variación diaria engaña',
                    body: 'Un activo que sube un 3 % en el día puede llevar un mes cayendo. La variación diaria es una fotografía de veinticuatro horas, no una tendencia. Antes de decidir nada, mira al menos una temporalidad superior.',
                  },
                  {
                    type: 'text',
                    title: 'La procedencia del dato',
                    body: 'En TradingLab, junto a cada cotización encontrarás un indicador con la fuente, el estado del mercado y la latencia. No es un adorno: un precio con quince minutos de retraso y un precio en tiempo real llevan a decisiones distintas, y tienes derecho a saber cuál estás viendo.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'Si el bid es 1,0864 y el ask 1,0866, ¿a qué precio compras?',
                      ['1,0864', '1,0865', '1,0866', 'Al que elijas'],
                      2,
                      'Compras al ask, que siempre es el más alto de los dos. Esa diferencia es el spread.',
                    ),
                    q(
                      'q2',
                      '¿Contra qué se calcula la variación porcentual diaria?',
                      [
                        'Contra el precio de hace 24 horas exactas.',
                        'Contra el cierre de la sesión anterior.',
                        'Contra el precio de apertura del mes.',
                        'Contra el precio al que abriste tu gráfico.',
                      ],
                      1,
                      'Se calcula contra el cierre previo, por eso puede saltar de golpe en la apertura tras un fin de semana.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'forex-desde-cero',
    title: 'Introducción a Forex',
    summary: 'Pares, pips, sesiones y qué mueve realmente a las divisas.',
    level: 'BASICO',
    topic: 'forex',
    icon: 'globe',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'forex-fundamentos',
        title: 'Fundamentos de Forex',
        summary: 'Cómo se estructura el mayor mercado del mundo.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'pares-y-cotizacion',
            title: 'Pares y cotización',
            lessons: [
              {
                slug: 'anatomia-de-un-par',
                title: 'Anatomía de un par de divisas',
                summary: 'En Forex nunca compras una divisa: compras una y vendes otra al mismo tiempo.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'forex',
                blocks: [
                  {
                    type: 'text',
                    body: 'EUR/USD no es «el euro». Es la relación entre el euro y el dólar. La primera divisa se llama base y la segunda, cotizada. El precio indica cuántas unidades de la cotizada hacen falta para comprar una unidad de la base.\n\nSi EUR/USD cotiza a 1,0865, un euro cuesta 1,0865 dólares. Cuando «compras EUR/USD» estás comprando euros y vendiendo dólares simultáneamente. Cuando lo vendes, haces lo contrario.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'Consecuencia práctica',
                    body: 'Un par puede subir porque la base se fortalece, porque la cotizada se debilita, o por ambas cosas. Antes de concluir «el euro está fuerte», comprueba qué hace también contra otras divisas.',
                  },
                  {
                    type: 'text',
                    title: 'El pip',
                    body: 'El pip es la unidad mínima de variación convencional. En la mayoría de pares equivale al cuarto decimal (0,0001); en los pares con yen, al segundo (0,01). Muchos proveedores muestran un decimal adicional, el pipette, para mayor precisión.\n\nMoverse de 1,0865 a 1,0870 son cinco pips.',
                  },
                  {
                    type: 'example',
                    title: 'Cuánto vale un pip',
                    body: 'En una posición de 10.000 unidades de EUR/USD, cada pip vale aproximadamente un dólar. Si tu stop loss está a treinta pips, arriesgas unos USD 30. Este cálculo es la base del dimensionado de posición: primero decides cuánto puedes perder, después calculas el tamaño, nunca al revés.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio en la terminal',
                    body: 'Abre EUR/USD en temporalidad de 1 hora. Identifica el máximo y el mínimo de las últimas veinticuatro horas y calcula el rango en pips. Compáralo con el mismo cálculo en USD/MXN. ¿Qué instrumento requiere un stop loss más amplio en términos absolutos?',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'Compras GBP/USD. ¿Qué estás haciendo exactamente?',
                      [
                        'Comprando libras y comprando dólares.',
                        'Comprando libras y vendiendo dólares.',
                        'Vendiendo libras y comprando dólares.',
                        'Solo comprando libras.',
                      ],
                      1,
                      'Toda operación en Forex implica dos divisas: compras la base y vendes la cotizada.',
                    ),
                    q(
                      'q2',
                      'El USD/JPY pasa de 151,42 a 151,92. ¿Cuántos pips se ha movido?',
                      ['5 pips', '50 pips', '500 pips', '0,5 pips'],
                      1,
                      'En pares con yen el pip es el segundo decimal, así que 0,50 equivale a 50 pips.',
                    ),
                    q(
                      'q3',
                      'El EUR/USD sube. ¿Qué se puede afirmar con certeza?',
                      [
                        'El euro se ha fortalecido.',
                        'El dólar se ha debilitado.',
                        'El euro se ha fortalecido respecto al dólar, sin saber cuál de los dos se movió.',
                        'La economía europea ha mejorado.',
                      ],
                      2,
                      'Un par mide una relación. Para saber qué divisa se movió, hay que compararla contra otras.',
                    ),
                  ],
                },
              },
              {
                slug: 'sesiones-y-horarios',
                title: 'Sesiones, horarios y volatilidad',
                summary: 'El mismo par se comporta de forma distinta según la hora a la que lo mires.',
                estimatedMinutes: 7,
                minPlan: 'FREE',
                topic: 'forex',
                blocks: [
                  {
                    type: 'text',
                    body: 'Forex funciona veinticuatro horas de lunes a viernes, pero no con la misma intensidad. La actividad se concentra en tres sesiones que se solapan: Asia, Europa y América.\n\nEl solapamiento entre Europa y América, aproximadamente entre las 13:00 y las 16:00 UTC, concentra la mayor parte del volumen en los pares principales. Fuera de esas horas, los movimientos son más estrechos y, cuando aparecen, menos fiables.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Un error frecuente',
                    body: 'Aplicar una estrategia diseñada para el solapamiento europeo-americano durante la sesión asiática. La estrategia no falla: falla el supuesto de liquidez sobre el que se construyó.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Durante una semana, registra en tu diario la hora UTC de cada simulación que abras. Al final, usa el análisis por horarios de tus estadísticas y comprueba si hay franjas donde tus decisiones son sistemáticamente peores.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuándo suele concentrarse el mayor volumen en los pares principales?',
                      [
                        'Durante la sesión asiática.',
                        'En el solapamiento entre Europa y América.',
                        'Los domingos por la noche.',
                        'Es constante durante las 24 horas.',
                      ],
                      1,
                      'El solapamiento europeo-americano reúne a los dos mayores centros de negociación.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'criptomonedas-y-blockchain',
    title: 'Criptomonedas y blockchain',
    summary: 'Qué hay debajo de un criptoactivo, por qué es tan volátil y qué riesgos son específicos.',
    level: 'BASICO',
    topic: 'cripto',
    icon: 'boxes',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'cripto-fundamentos',
        title: 'Fundamentos de criptoactivos',
        summary: 'Tecnología, mercado y riesgos propios.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'cripto-basico',
            title: 'Conceptos básicos',
            lessons: [
              {
                slug: 'que-es-un-criptoactivo',
                title: 'Qué es un criptoactivo',
                summary: 'Un registro compartido, unas reglas de emisión y un mercado abierto todos los días del año.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'cripto',
                blocks: [
                  {
                    type: 'text',
                    body: 'Un criptoactivo es una anotación en un registro distribuido que muchas partes mantienen simultáneamente y cuyas reglas de modificación están definidas por software. La innovación no es el «dinero digital»: las transferencias bancarias ya lo eran. La innovación es que no hace falta una entidad central que lleve la contabilidad.\n\nDe ahí se derivan sus propiedades y también sus riesgos.',
                  },
                  {
                    type: 'checklist',
                    title: 'Riesgos específicos que no tienen otros activos',
                    body: '',
                    items: [
                      'Riesgo tecnológico: un fallo en el protocolo o en un contrato inteligente puede ser irreversible.',
                      'Riesgo regulatorio: el marco legal cambia y puede hacerlo de golpe.',
                      'Riesgo de custodia: si pierdes las claves, no hay servicio de atención al cliente que las recupere.',
                      'Riesgo de liquidez: fuera de los pocos activos principales, el mercado puede ser muy estrecho.',
                      'Mercado abierto 24/7: los movimientos ocurren mientras duermes, sin cierre que ponga una pausa.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Volatilidad, en cifras',
                    body: 'La volatilidad anualizada de Bitcoin ha superado históricamente varias veces la del S&P 500. En la práctica, un mismo tamaño de posición representa un riesgo mucho mayor. Ajustar el tamaño según la volatilidad no es una preferencia: es una necesidad aritmética.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio en la terminal',
                    body: 'Añade el ATR de 14 periodos a BTC/USD y a EUR/USD en temporalidad diaria. Divide en cada caso el ATR entre el precio para obtener la volatilidad relativa. Con ese dato, calcula qué tamaño de posición tendrías que usar en cada uno para arriesgar la misma cantidad de saldo virtual.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuál es un riesgo específico de los criptoactivos frente a una acción cotizada?',
                      [
                        'Que su precio pueda bajar.',
                        'Que la pérdida de las claves privadas sea irreversible.',
                        'Que existan comisiones.',
                        'Que dependan de la oferta y la demanda.',
                      ],
                      1,
                      'La autocustodia sin intermediario elimina el mecanismo de recuperación que sí existe en la banca tradicional.',
                    ),
                    q(
                      'q2',
                      'Si BTC/USD tiene el triple de volatilidad relativa que EUR/USD, para arriesgar lo mismo deberías...',
                      [
                        'Usar el mismo tamaño de posición.',
                        'Usar un tamaño de posición aproximadamente tres veces menor.',
                        'Usar un tamaño tres veces mayor.',
                        'No importa, el stop loss lo compensa.',
                      ],
                      1,
                      'A mayor volatilidad, menor tamaño para mantener constante el riesgo monetario.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'acciones-e-indices',
    title: 'Acciones e índices',
    summary: 'Qué compras cuando compras una acción y qué mide realmente un índice.',
    level: 'BASICO',
    topic: 'acciones',
    icon: 'building',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'renta-variable',
        title: 'Renta variable',
        summary: 'De la acción individual al índice.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'acciones-basico',
            title: 'Acciones e índices',
            lessons: [
              {
                slug: 'que-es-una-accion',
                title: 'Qué es una acción y qué mide un índice',
                summary: 'Propiedad parcial de una empresa, y cestas que resumen un mercado entero en un número.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'acciones',
                blocks: [
                  {
                    type: 'text',
                    body: 'Una acción representa una participación en la propiedad de una empresa. Su precio refleja las expectativas del mercado sobre los beneficios futuros de esa empresa, descontados a hoy y ajustados por el riesgo percibido.\n\nUn índice es una cesta de acciones resumida en un único número. El S&P 500 pondera por capitalización: las mayores compañías pesan más. Eso significa que un índice «amplio» puede estar, en la práctica, dominado por unas pocas empresas.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'Diversificación aparente',
                    body: 'Comprar un índice ponderado por capitalización no siempre diversifica tanto como parece. Si las diez mayores compañías representan un tercio del índice y pertenecen al mismo sector, tu exposición está más concentrada de lo que sugiere el número 500.',
                  },
                  {
                    type: 'text',
                    title: 'Qué mueve a una acción',
                    body: 'A corto plazo: resultados trimestrales, revisiones de estimaciones, noticias sectoriales y flujos. A largo plazo: la capacidad real de la empresa de generar beneficios crecientes.\n\nConfundir ambos horizontes es una fuente habitual de frustración: una empresa excelente puede tener una acción que cae durante meses porque el precio ya descontaba una excelencia mayor.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'Un índice ponderado por capitalización implica que...',
                      [
                        'Todas las empresas pesan lo mismo.',
                        'Las empresas más grandes tienen mayor peso en el índice.',
                        'Solo incluye empresas tecnológicas.',
                        'El precio se calcula sumando las cotizaciones.',
                      ],
                      1,
                      'A mayor capitalización, mayor influencia en el movimiento del índice.',
                    ),
                    q(
                      'q2',
                      'Una empresa presenta buenos resultados y su acción cae. ¿Cuál es la explicación más probable?',
                      [
                        'El mercado es irracional.',
                        'Los resultados fueron buenos pero por debajo de lo que el precio ya descontaba.',
                        'Hubo un error de cotización.',
                        'Los resultados no afectan al precio.',
                      ],
                      1,
                      'El precio incorpora expectativas: lo relevante es la sorpresa respecto a lo esperado, no el dato absoluto.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'commodities',
    title: 'Commodities',
    summary: 'Metales, energía y agrícolas: activos que responden a la oferta física y a la geopolítica.',
    level: 'INTERMEDIO',
    topic: 'commodities',
    icon: 'fuel',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'materias-primas',
        title: 'Materias primas',
        summary: 'Qué las mueve y por qué no se parecen a las acciones.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'commodities-basico',
            title: 'Conceptos básicos',
            lessons: [
              {
                slug: 'oro-y-petroleo',
                title: 'Oro y petróleo: dos lógicas distintas',
                summary: 'Uno responde a tipos reales y aversión al riesgo; el otro, a inventarios y geopolítica.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'commodities',
                blocks: [
                  {
                    type: 'text',
                    body: 'El oro no genera flujo de caja. No paga dividendos ni intereses. Su atractivo depende, en buena medida, de lo que cuesta no tener otra cosa: cuando los tipos de interés reales caen, mantener oro «cuesta» menos y suele apreciarse. También funciona como refugio en episodios de aversión al riesgo.\n\nEl petróleo, en cambio, responde a una lógica de oferta y demanda física: inventarios, capacidad de producción, decisiones de los países productores, interrupciones logísticas y ciclo económico.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Cuidado con las correlaciones',
                    body: 'Las relaciones históricas entre commodities y otros activos son inestables. «El oro sube cuando cae el dólar» funciona a menudo, hasta que deja de hacerlo durante meses. Una correlación no es una regla.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Compara en la terminal la evolución de XAU/USD y WTI/USD durante el mismo periodo. Anota en tu diario tres momentos donde se movieron en el mismo sentido y tres donde se movieron en sentidos opuestos. Intenta explicar cada caso.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Por qué el oro suele apreciarse cuando caen los tipos de interés reales?',
                      [
                        'Porque el oro paga un cupón vinculado a los tipos.',
                        'Porque disminuye el coste de oportunidad de mantener un activo que no genera rendimiento.',
                        'Porque los bancos centrales están obligados a comprarlo.',
                        'Porque aumenta la producción minera.',
                      ],
                      1,
                      'Al no generar rendimiento, el oro compite peor cuando los tipos reales son altos y mejor cuando son bajos.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'lectura-de-graficos',
    title: 'Lectura de gráficos',
    summary: 'Velas, temporalidades y estructura de precio. La base del análisis técnico.',
    level: 'BASICO',
    topic: 'analisis-tecnico',
    icon: 'candlestick-chart',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'graficos',
        title: 'Gráficos y estructura',
        summary: 'Cómo leer lo que el precio ya hizo.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'velas',
            title: 'Velas y temporalidades',
            lessons: [
              {
                slug: 'anatomia-de-una-vela',
                title: 'Anatomía de una vela',
                summary: 'Cuatro precios resumidos en una figura. Qué información conserva y cuál pierde.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'analisis-tecnico',
                blocks: [
                  {
                    type: 'text',
                    body: 'Una vela resume cuatro datos de un periodo: apertura, máximo, mínimo y cierre. El cuerpo va de la apertura al cierre; las mechas llegan hasta los extremos.\n\nEn TradingLab las velas alcistas se dibujan con cuerpo relleno y las bajistas con cuerpo hueco, además del color. Es una decisión de accesibilidad: la forma comunica la dirección aunque no distingas rojo y verde.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Lo que una vela oculta',
                    body: 'Una vela no dice en qué orden ocurrieron el máximo y el mínimo. Dos velas idénticas pueden corresponder a recorridos completamente distintos. Por eso, cuando una simulación toca stop loss y take profit en la misma vela, asumimos de forma conservadora que se ejecutó primero el stop loss.',
                  },
                  {
                    type: 'chart',
                    title: 'Observa una serie real',
                    body: 'Este gráfico usa el motor educativo de la plataforma. Identifica una vela con cuerpo pequeño y mechas largas: indica que hubo recorrido en ambos sentidos y que el periodo terminó cerca de donde empezó.',
                    symbol: 'EURUSD',
                    timeframe: '1h',
                  },
                  {
                    type: 'text',
                    title: 'Temporalidades',
                    body: 'La misma serie de precios produce lecturas distintas según la temporalidad. Un movimiento que en el gráfico de 5 minutos parece una tendencia clara puede ser, en el diario, una mecha irrelevante.\n\nRegla práctica: decide primero el horizonte de tu hipótesis y elige después la temporalidad, no al revés.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Qué información NO contiene una vela?',
                      [
                        'El precio de cierre.',
                        'El orden temporal en que se alcanzaron el máximo y el mínimo.',
                        'El precio de apertura.',
                        'El rango del periodo.',
                      ],
                      1,
                      'La vela conserva los cuatro precios pero pierde la secuencia interna del movimiento.',
                    ),
                    q(
                      'q2',
                      'Una vela con cuerpo muy pequeño y mechas largas indica que...',
                      [
                        'El precio subió con fuerza.',
                        'Hubo recorrido en ambos sentidos y el periodo cerró cerca de donde abrió.',
                        'No hubo negociación.',
                        'El mercado estaba cerrado.',
                      ],
                      1,
                      'Las mechas largas indican rechazo en ambos extremos; el cuerpo pequeño, ausencia de avance neto.',
                    ),
                  ],
                },
              },
              {
                slug: 'soportes-y-resistencias',
                title: 'Soportes y resistencias',
                summary: 'Zonas, no líneas. Por qué funcionan y por qué fallan.',
                estimatedMinutes: 10,
                minPlan: 'FREE',
                topic: 'analisis-tecnico',
                requiresSimulation: true,
                blocks: [
                  {
                    type: 'text',
                    body: 'Un soporte es una zona donde históricamente ha aparecido interés comprador suficiente para frenar una caída. Una resistencia es lo simétrico por arriba.\n\nDos precisiones que cambian mucho la práctica:\n\nPrimera: son zonas, no líneas. Dibujar una resistencia en 1,0872 exactamente sugiere una precisión que no existe. Piensa en rangos.\n\nSegunda: funcionan en buena medida porque muchos participantes las observan y actúan en consecuencia. Es una profecía parcialmente autocumplida, lo que también explica por qué a veces se rompen de forma violenta: cuando se acumulan órdenes de protección al otro lado del nivel, atravesarlo desencadena una cascada.',
                  },
                  {
                    type: 'example',
                    title: 'Un caso típico',
                    body: 'El precio se acerca tres veces a una resistencia sin superarla. Muchos participantes sitúan órdenes de protección justo por encima. Cuando el precio finalmente la supera, esas órdenes se ejecutan y aceleran el movimiento. El resultado es que el nivel se rompe con más fuerza de la que sugería el contexto previo.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'El nivel roto cambia de papel',
                    body: 'Una resistencia superada con convicción tiende a comportarse después como soporte. Es la misma zona, mirada desde el otro lado.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio con simulación',
                    body: 'Elige un instrumento y marca una zona de soporte o resistencia que observes en el gráfico de 1 hora. Crea una simulación de hipótesis con un plazo de 4 horas, y escribe en el motivo: dónde está la zona, por qué la consideras relevante y qué precio demostraría que te equivocaste. Al cerrarse, pide al entrenador una revisión posterior.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Por qué es preferible pensar en zonas y no en líneas exactas?',
                      [
                        'Porque las líneas son difíciles de dibujar.',
                        'Porque el interés comprador o vendedor se distribuye en un rango de precios, no en un punto.',
                        'Porque los gráficos tienen errores.',
                        'Porque así se evita el spread.',
                      ],
                      1,
                      'Las órdenes se acumulan en rangos. Exigir precisión al céntimo genera falsas invalidaciones.',
                    ),
                    q(
                      'q2',
                      'Una resistencia se rompe con fuerza inusual. ¿Qué explicación es más plausible?',
                      [
                        'El mercado se equivocó.',
                        'Se activaron órdenes de protección acumuladas por encima del nivel.',
                        'El indicador falló.',
                        'Hubo un error del proveedor de datos.',
                      ],
                      1,
                      'La acumulación de órdenes al otro lado de un nivel muy observado produce movimientos en cascada.',
                    ),
                    q(
                      'q3',
                      'Tras romperse con convicción, una resistencia tiende a...',
                      [
                        'Desaparecer del gráfico.',
                        'Actuar como soporte.',
                        'Convertirse en una resistencia más fuerte.',
                        'Invertir la tendencia.',
                      ],
                      1,
                      'El nivel cambia de papel: quienes vendían ahí ahora pueden defenderlo como compradores.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'indicadores-tecnicos',
    title: 'Indicadores técnicos',
    summary: 'Medias, osciladores y volatilidad. Qué mide cada uno y qué no puede medir ninguno.',
    level: 'INTERMEDIO',
    topic: 'analisis-tecnico',
    icon: 'activity',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'indicadores',
        title: 'Indicadores y osciladores',
        summary: 'Herramientas de medición, no bolas de cristal.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'medias-y-osciladores',
            title: 'Medias y osciladores',
            lessons: [
              {
                slug: 'medias-moviles',
                title: 'Medias móviles',
                summary: 'Suavizan el precio para hacer visible la dirección. Y por eso siempre llegan tarde.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'indicadores',
                blocks: [
                  {
                    type: 'text',
                    body: 'Una media móvil es el promedio del precio de cierre de los últimos N periodos. Su función es filtrar ruido para que la dirección predominante sea visible.\n\nEl coste de ese filtrado es el retraso. Una media de 200 periodos es muy estable, pero reacciona tarde. Una de 20 reacciona pronto, pero produce muchas señales falsas en mercados laterales. No hay una configuración correcta: hay un intercambio entre sensibilidad y fiabilidad que debes elegir conscientemente.',
                  },
                  {
                    type: 'text',
                    title: 'Simple frente a exponencial',
                    body: 'La media simple da el mismo peso a todos los periodos. La exponencial da más peso a los recientes, por lo que reacciona antes. Ninguna es superior: la exponencial es preferible cuando te importa la reactividad, la simple cuando te importa la estabilidad.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'El cruce de medias no es una señal de compra',
                    body: 'Un cruce indica que la relación entre dos promedios cambió. En una tendencia clara suele coincidir con movimientos aprovechables; en un mercado lateral genera cruces continuos en ambos sentidos. Antes de usar un cruce, verifica si el contexto es tendencial o lateral.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Aplica las medias de 20 y 50 a un instrumento en temporalidad de 1 hora. Cuenta cuántos cruces se produjeron en las últimas cien velas y cuántos de ellos habrían resultado en un movimiento significativo posterior. Anota la proporción en tu diario.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuál es el coste inevitable de suavizar el precio con una media móvil?',
                      ['El spread aumenta', 'El retraso en la señal', 'Se pierde el volumen', 'Aumenta la volatilidad'],
                      1,
                      'Todo suavizado implica retraso: la media describe lo que ya pasó.',
                    ),
                    q(
                      'q2',
                      'En un mercado lateral, un sistema basado en cruces de medias tenderá a...',
                      [
                        'Funcionar mejor que en tendencia.',
                        'Generar muchas señales falsas en ambos sentidos.',
                        'No generar ninguna señal.',
                        'Predecir la ruptura.',
                      ],
                      1,
                      'Sin dirección dominante, las medias se cruzan repetidamente sin que siga un movimiento aprovechable.',
                    ),
                  ],
                },
              },
              {
                slug: 'rsi-y-osciladores',
                title: 'RSI y osciladores',
                summary: 'Sobrecompra no significa que vaya a bajar. Un malentendido muy caro.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'indicadores',
                blocks: [
                  {
                    type: 'text',
                    body: 'El RSI compara la magnitud de las subidas recientes con la de las bajadas y produce un valor entre 0 y 100. Convencionalmente se habla de sobrecompra por encima de 70 y sobreventa por debajo de 30.\n\nAquí está el malentendido más extendido del análisis técnico: sobrecompra no significa «va a bajar». Significa que las subidas recientes han sido intensas. En una tendencia fuerte, el RSI puede permanecer por encima de 70 durante semanas mientras el precio sigue subiendo.',
                  },
                  {
                    type: 'callout',
                    tone: 'danger',
                    title: 'Error clásico y costoso',
                    body: 'Vender solo porque el RSI marca 75. Es equivalente a apostar contra un movimiento por el hecho de que ha sido fuerte. Muchas cuentas se han vaciado exactamente así.',
                  },
                  {
                    type: 'text',
                    title: 'Un uso más razonable',
                    body: 'El RSI aporta más como confirmación contextual que como señal aislada: comprobar si el impulso acompaña a una ruptura, o detectar divergencias donde el precio marca un nuevo extremo pero el oscilador no.\n\nY aun así, una divergencia no es una señal de giro: es una observación que exige buscar más evidencia.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'El RSI marca 78. ¿Qué se puede concluir?',
                      [
                        'Que el precio va a bajar.',
                        'Que las subidas recientes han sido intensas respecto a las bajadas.',
                        'Que hay que vender inmediatamente.',
                        'Que la tendencia ha terminado.',
                      ],
                      1,
                      'El RSI mide intensidad relativa del movimiento reciente, no anticipa la dirección futura.',
                    ),
                    q(
                      'q2',
                      'En una tendencia alcista muy fuerte, el RSI puede...',
                      [
                        'Mantenerse sobre 70 durante mucho tiempo mientras el precio sigue subiendo.',
                        'Bajar automáticamente a 50.',
                        'Dejar de calcularse.',
                        'Invertir su significado.',
                      ],
                      0,
                      'Es exactamente lo que ocurre en tendencias fuertes, y por eso operar contra él es tan arriesgado.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'gestion-del-riesgo',
    title: 'Gestión del riesgo',
    summary: 'La única parte del resultado que puedes controlar por completo.',
    level: 'BASICO',
    topic: 'gestion-del-riesgo',
    icon: 'shield',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'riesgo',
        title: 'Riesgo y tamaño de posición',
        summary: 'Primero decides cuánto puedes perder. Todo lo demás viene después.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'dimensionado',
            title: 'Dimensionado y protección',
            lessons: [
              {
                slug: 'tamano-de-posicion',
                title: 'Tamaño de posición',
                summary: 'La decisión más importante, y la que menos atención suele recibir.',
                estimatedMinutes: 11,
                minPlan: 'FREE',
                requiresSimulation: true,
                topic: 'gestion-del-riesgo',
                blocks: [
                  {
                    type: 'text',
                    body: 'El orden correcto es este:\n\n1. Decides qué porcentaje de tu saldo estás dispuesto a perder en esta operación.\n2. Decides dónde estaría el precio si tu hipótesis fuera incorrecta. Ahí va el stop loss.\n3. De esos dos datos se deduce el tamaño de la posición.\n\nLa mayoría de las personas lo hace al revés: elige un tamaño que «le parece bien», coloca el stop loss donde le resulta cómodo y descubre el riesgo real después. Eso no es gestión del riesgo: es esperar que salga bien.',
                  },
                  {
                    type: 'example',
                    title: 'Cálculo completo',
                    body: 'Saldo virtual: USD 10.000. Riesgo aceptado por operación: 1 %, es decir USD 100.\n\nCompras EUR/USD en 1,0865 y sitúas el stop loss en 1,0835. La distancia es de 30 pips.\n\nTamaño = riesgo aceptado / (distancia del stop × valor del pip por unidad).\n\nCon un valor aproximado de USD 1 por pip cada 10.000 unidades, el tamaño resultante es de unas 33.000 unidades. Si hubieras elegido primero «voy a operar 100.000 unidades», tu riesgo real habría sido de USD 300, el triple de lo que estabas dispuesto a perder.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Por qué el 1 % o el 2 %',
                    body: 'No es una cifra mágica. Es aritmética de supervivencia: con un 1 % por operación, diez pérdidas seguidas te dejan cerca del 90 % del saldo. Con un 10 %, te dejan cerca del 35 %. Y recuperar una caída del 65 % exige casi triplicar lo que queda.',
                  },
                  {
                    type: 'checklist',
                    title: 'Antes de confirmar cualquier simulación',
                    body: '',
                    items: [
                      'Sé exactamente cuántos USD virtuales pierdo si se activa el stop loss.',
                      'Esa cifra es un porcentaje pequeño de mi saldo, y lo he calculado, no estimado.',
                      'El stop loss está donde mi hipótesis queda invalidada, no donde me resulta cómodo.',
                      'Si el stop loss está muy cerca, es porque el nivel lo justifica, no porque quería una posición grande.',
                    ],
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio con simulación obligatoria',
                    body: 'Crea una posición simulada con un riesgo objetivo del 1 % de tu saldo virtual. Calcula tú el tamaño antes de introducirlo. Al confirmarla, comprueba en el panel de riesgo si la cifra que muestra la plataforma coincide con la tuya. Si no coincide, revisa el cálculo: el error está casi siempre en el valor del pip.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuál es el orden correcto de decisión?',
                      [
                        'Tamaño → stop loss → riesgo resultante.',
                        'Riesgo aceptado → nivel de invalidación → tamaño resultante.',
                        'Stop loss → tamaño → riesgo.',
                        'El orden es indiferente.',
                      ],
                      1,
                      'El tamaño es una consecuencia de las dos decisiones anteriores, nunca un punto de partida.',
                    ),
                    q(
                      'q2',
                      'Saldo USD 10.000, riesgo 2 %, stop a 50 pips, valor de pip USD 1 por cada 10.000 unidades. ¿Qué tamaño aproximado corresponde?',
                      ['10.000 unidades', '40.000 unidades', '100.000 unidades', '200.000 unidades'],
                      1,
                      'Riesgo = USD 200. 200 / 50 pips = USD 4 por pip = 40.000 unidades.',
                    ),
                    q(
                      'q3',
                      'Tras perder el 50 % del saldo, ¿cuánto hay que ganar sobre lo restante para volver al punto inicial?',
                      ['50 %', '75 %', '100 %', '150 %'],
                      2,
                      'La asimetría de las pérdidas: recuperar exige duplicar lo que queda. Por eso limitar el daño importa más que maximizar la ganancia.',
                    ),
                  ],
                },
              },
              {
                slug: 'stop-loss-y-take-profit',
                title: 'Stop loss y take profit',
                summary: 'Dónde ponerlos, cuándo moverlos y por qué moverlos casi siempre es un error.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'gestion-del-riesgo',
                blocks: [
                  {
                    type: 'text',
                    body: 'El stop loss no es un límite de pérdida arbitrario: es el precio en el que tu hipótesis deja de tener sentido. Si compraste porque el precio defendía una zona, el stop va por debajo de esa zona. Si el precio la pierde, tu razón para estar dentro desapareció.\n\nEl take profit es lo simétrico: el punto donde tu hipótesis se habría cumplido y el recorrido esperado se agota.',
                  },
                  {
                    type: 'callout',
                    tone: 'danger',
                    title: 'Mover el stop loss en contra',
                    body: 'Alejar el stop loss cuando el precio se acerca es la forma más común de convertir una pérdida planificada en una pérdida grave. Si lo has hecho, no fue una decisión de análisis: fue una decisión de incomodidad.',
                  },
                  {
                    type: 'text',
                    title: 'La distancia mínima razonable',
                    body: 'Un stop loss más ajustado que la volatilidad normal del instrumento se activará por ruido, no porque tu análisis falle. Usa el ATR como referencia: si el rango medio por vela es de 15 pips, un stop de 8 pips se activará constantemente sin que tu hipótesis haya sido puesta a prueba.',
                  },
                  {
                    type: 'text',
                    title: 'El trailing stop',
                    body: 'Un trailing stop sigue al precio a una distancia fija cuando se mueve a tu favor, y se queda quieto cuando se mueve en contra. Protege beneficio acumulado a cambio de aceptar salidas más tempranas en movimientos con retrocesos amplios. Es una herramienta, no una mejora automática.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Dónde debe situarse el stop loss?',
                      [
                        'A una distancia fija en todos los instrumentos.',
                        'Donde la hipótesis quedaría invalidada, respetando la volatilidad del instrumento.',
                        'Lo más cerca posible para arriesgar poco.',
                        'Donde el operador se sienta cómodo.',
                      ],
                      1,
                      'El stop marca la invalidación de la idea; su distancia debe ser coherente con el ruido normal del activo.',
                    ),
                    q(
                      'q2',
                      'Alejar el stop loss cuando el precio se acerca a él...',
                      [
                        'Mejora las probabilidades de la operación.',
                        'Convierte una pérdida acotada y planificada en una pérdida potencialmente mayor.',
                        'Es una técnica avanzada recomendable.',
                        'No tiene efecto sobre el riesgo.',
                      ],
                      1,
                      'Aleja el punto de salida sin que haya cambiado el análisis: el riesgo real aumenta.',
                    ),
                  ],
                },
              },
              {
                slug: 'apalancamiento',
                title: 'Riesgos del apalancamiento',
                summary: 'No multiplica tus aciertos: multiplica el tamaño, y con él el coste de cada error.',
                estimatedMinutes: 8,
                minPlan: 'FREE',
                topic: 'gestion-del-riesgo',
                blocks: [
                  {
                    type: 'text',
                    body: 'Con apalancamiento 1:100, USD 100 controlan una posición de USD 10.000. La lectura correcta no es «gano cien veces más», sino «un movimiento del 1 % en contra consume toda mi garantía».\n\nEl apalancamiento no cambia la probabilidad de acertar. Solo cambia cuánto cuesta equivocarse, y reduce el margen para que una hipótesis correcta tenga tiempo de desarrollarse.',
                  },
                  {
                    type: 'example',
                    title: 'Comparación directa',
                    body: 'Misma hipótesis, mismo instrumento, mismo stop loss del 2 %.\n\nCon 1:1, una pérdida del 2 % del nocional equivale al 2 % de tu capital.\nCon 1:10, equivale al 20 %.\nCon 1:50, la posición se habría liquidado mucho antes de llegar al stop.\n\nLa hipótesis era idéntica en los tres casos. Lo único que cambió fue cuánto sobrevives al camino.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio con simulación',
                    body: 'Crea tres posiciones simuladas sobre el mismo instrumento, misma dirección y mismo stop loss, con apalancamiento 1, 10 y 50. Registra en el diario cuánto saldo virtual arriesgas en cada una. Es el mismo análisis con tres consecuencias distintas.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'En esta plataforma',
                    body: 'El apalancamiento es exclusivamente simulado y existe para que veas su efecto sin que te cueste dinero. No hay llamadas de margen que generen deuda: la pérdida máxima de una simulación es el saldo virtual comprometido.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'El apalancamiento afecta principalmente a...',
                      [
                        'La probabilidad de acertar la dirección.',
                        'El tamaño de la posición y, por tanto, la magnitud del resultado.',
                        'La calidad del análisis técnico.',
                        'La liquidez del mercado.',
                      ],
                      1,
                      'Amplifica el tamaño, no la calidad de la decisión.',
                    ),
                    q(
                      'q2',
                      'Con apalancamiento 1:100, ¿qué movimiento adverso consume aproximadamente la garantía?',
                      ['10 %', '5 %', '1 %', '0,1 %'],
                      2,
                      'Con 1:100, un 1 % del nocional equivale al 100 % de la garantía aportada.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'psicologia-del-trading',
    title: 'Psicología del trading',
    summary: 'Los sesgos que te llevan a romper tu propio plan, y cómo detectarlos con datos.',
    level: 'INTERMEDIO',
    topic: 'psicologia',
    icon: 'brain',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'psicologia',
        title: 'Conducta y decisión',
        summary: 'Reconocer patrones propios antes de que se conviertan en costumbre.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'sesgos',
            title: 'Sesgos y disciplina',
            lessons: [
              {
                slug: 'sesgos-frecuentes',
                title: 'Los sesgos que más dinero cuestan',
                summary: 'Aversión a la pérdida, sesgo de confirmación, exceso de confianza y falacia del jugador.',
                estimatedMinutes: 11,
                minPlan: 'FREE',
                topic: 'psicologia',
                blocks: [
                  {
                    type: 'text',
                    title: 'Aversión a la pérdida',
                    body: 'Perder duele aproximadamente el doble de lo que agrada ganar la misma cantidad. La consecuencia práctica es característica: cerramos las ganancias pronto para asegurarlas y mantenemos las pérdidas esperando que se recuperen.\n\nEse patrón produce una estadística curiosa: un porcentaje alto de aciertos con resultado agregado negativo. Si eso te ocurre, revisa el tamaño medio de tus ganancias frente al de tus pérdidas.',
                  },
                  {
                    type: 'text',
                    title: 'Sesgo de confirmación',
                    body: 'Una vez formada la hipótesis, buscamos evidencia que la respalde y descartamos la que la contradice. Es especialmente peligroso en análisis técnico, donde hay tantos indicadores disponibles que siempre puedes encontrar uno que te dé la razón.\n\nAntídoto concreto: antes de abrir, escribe la evidencia en contra. En TradingLab el entrenador siempre presenta ambos lados precisamente por esto.',
                  },
                  {
                    type: 'text',
                    title: 'Exceso de confianza',
                    body: 'Después de una racha de aciertos tendemos a aumentar el tamaño. El problema es que una racha corta no distingue habilidad de suerte, y el aumento de tamaño llega justo antes de la regresión a la media.',
                  },
                  {
                    type: 'text',
                    title: 'Falacia del jugador',
                    body: '«Llevo cinco pérdidas seguidas, la siguiente tiene que salir bien». El mercado no lleva la cuenta. Cada operación es independiente de las anteriores en ese sentido, y la creencia contraria conduce directamente a aumentar el riesgo tras perder.',
                  },
                  {
                    type: 'callout',
                    tone: 'danger',
                    title: 'La secuencia que arruina cuentas',
                    body: 'Pérdida → frustración → aumentar el tamaño para recuperar → pérdida mayor → pánico. En TradingLab el sistema detecta simulaciones abiertas con menos de tres minutos de diferencia y te lo señala como posible operación impulsiva. No es un reproche: es un dato.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Durante dos semanas registra la emoción antes y después de cada simulación. Al terminar, filtra tu diario por «impaciente» y «frustrado», y compara la puntuación de disciplina de esas operaciones con las marcadas como «enfocado». La diferencia suele ser mayor de lo esperado.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'Tienes un 70 % de aciertos pero resultado agregado negativo. ¿Qué explica mejor esta combinación?',
                      [
                        'El porcentaje de aciertos está mal calculado.',
                        'Tus pérdidas medias son mucho mayores que tus ganancias medias.',
                        'El mercado está manipulado.',
                        'Necesitas más indicadores.',
                      ],
                      1,
                      'Es el patrón típico de la aversión a la pérdida: se cortan las ganancias y se dejan correr las pérdidas.',
                    ),
                    q(
                      'q2',
                      '«Llevo cinco pérdidas seguidas, la próxima tiene que salir bien» es un ejemplo de...',
                      ['Sesgo de confirmación', 'Falacia del jugador', 'Aversión a la pérdida', 'Efecto anclaje'],
                      1,
                      'Atribuye memoria a un proceso que no la tiene, y suele preceder a un aumento del riesgo.',
                    ),
                    q(
                      'q3',
                      '¿Cuál es un antídoto práctico contra el sesgo de confirmación?',
                      [
                        'Usar más indicadores hasta encontrar consenso.',
                        'Escribir explícitamente la evidencia en contra antes de abrir.',
                        'Operar con mayor tamaño para compensar.',
                        'Evitar leer noticias.',
                      ],
                      1,
                      'Obligarse a formular el caso contrario es la contramedida más efectiva y la que aplica el entrenador de la plataforma.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'diario-y-disciplina',
    title: 'Diario y disciplina',
    summary: 'Cómo convertir cada simulación en información utilizable.',
    level: 'BASICO',
    topic: 'diario-y-disciplina',
    icon: 'notebook',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'diario',
        title: 'El diario de aprendizaje',
        summary: 'La herramienta más aburrida y la más determinante.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'registro',
            title: 'Registro y revisión',
            lessons: [
              {
                slug: 'como-llevar-un-diario',
                title: 'Cómo llevar un diario que sirva',
                summary: 'Qué registrar, con qué frecuencia revisarlo y qué preguntas hacerle.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                requiresSimulation: true,
                topic: 'diario-y-disciplina',
                blocks: [
                  {
                    type: 'text',
                    body: 'Un diario que solo registra entradas, salidas y resultado no sirve de mucho: esa información ya la tiene el historial. El valor está en registrar el estado del proceso.',
                  },
                  {
                    type: 'checklist',
                    title: 'Qué registrar en cada entrada',
                    body: '',
                    items: [
                      'La hipótesis, en una frase concreta y falsable.',
                      'Qué indicadores estabas mirando y qué te dijeron.',
                      'La emoción antes de abrir.',
                      'El riesgo asumido, en porcentaje del saldo.',
                      'Qué precio te habría demostrado que estabas equivocado.',
                      'Al cerrar: la emoción posterior, el error identificado y la lección concreta.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'Regla de las dos frases',
                    body: 'Si no puedes resumir tu hipótesis en dos frases, probablemente no la tienes clara. Escribirla es la prueba.',
                  },
                  {
                    type: 'text',
                    title: 'La revisión semanal',
                    body: 'Reserva veinte minutos a la semana. Filtra tu diario por resultado y busca lo que se repite: ¿el mismo error?, ¿el mismo instrumento?, ¿la misma franja horaria?, ¿el mismo estado emocional?\n\nLos patrones aparecen mucho antes en la conducta que en el resultado.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio con simulación',
                    body: 'Crea una simulación y complétala con una entrada de diario incluyendo todos los campos de la lista. Al cerrarse, pide una revisión posterior al entrenador y compara su lectura con la tuya. Anota en qué coincidís y en qué no.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Qué aporta el diario que no aporta el historial de operaciones?',
                      [
                        'Los precios de entrada y salida.',
                        'El contexto de la decisión: hipótesis, emoción, riesgo y criterio de invalidación.',
                        'El resultado en dinero.',
                        'La comisión pagada.',
                      ],
                      1,
                      'El historial registra qué pasó; el diario registra por qué decidiste lo que decidiste.',
                    ),
                    q(
                      'q2',
                      '¿Por qué el proceso es más evaluable que el resultado en una muestra pequeña?',
                      [
                        'Porque el resultado no importa.',
                        'Porque el resultado depende en parte del azar de corto plazo, mientras que el proceso es observable en cada operación.',
                        'Porque el proceso siempre es correcto.',
                        'Porque el resultado se calcula mal.',
                      ],
                      1,
                      'Con pocas operaciones no se puede distinguir habilidad de suerte, pero sí verificar si se cumplió el plan.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'analisis-fundamental',
    title: 'Noticias y análisis fundamental',
    summary: 'Cómo leer datos macroeconómicos sin reaccionar al titular.',
    level: 'INTERMEDIO',
    topic: 'analisis-fundamental',
    icon: 'newspaper',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'fundamental',
        title: 'Análisis fundamental',
        summary: 'Del dato macro al movimiento del precio.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'macro',
            title: 'Datos macroeconómicos',
            lessons: [
              {
                slug: 'leer-el-calendario-economico',
                title: 'Leer el calendario económico',
                summary: 'Lo que mueve el precio es la sorpresa respecto a lo esperado, no la cifra.',
                estimatedMinutes: 9,
                minPlan: 'FREE',
                topic: 'analisis-fundamental',
                blocks: [
                  {
                    type: 'text',
                    body: 'El mercado incorpora las expectativas antes de la publicación. Cuando sale el dato, lo que provoca el movimiento es la diferencia entre lo publicado y lo esperado por el consenso.\n\nPor eso una inflación del 3,2 % puede hacer subir al dólar un día y bajarlo otro: depende de si se esperaba 3,0 % o 3,5 %.',
                  },
                  {
                    type: 'checklist',
                    title: 'Antes de una publicación de impacto alto',
                    body: '',
                    items: [
                      'Comprueba qué se espera, no solo qué se publica.',
                      'Ten presente que el spread suele ampliarse en los momentos previos y posteriores.',
                      'La primera reacción se revierte parcialmente con frecuencia.',
                      'Un stop loss ajustado tiene alta probabilidad de activarse por la volatilidad del momento.',
                      'Decide antes qué harás en cada escenario, o decide no hacer nada.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'Los eventos en el gráfico',
                    body: 'En la terminal de TradingLab los eventos económicos aparecen marcados sobre el gráfico. Cuando revises una simulación pasada, comprueba si el movimiento coincidió con una publicación: muchas veces la explicación no está en el análisis técnico.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Qué provoca principalmente el movimiento tras un dato macroeconómico?',
                      [
                        'El valor absoluto del dato.',
                        'La diferencia entre el dato publicado y el esperado por el consenso.',
                        'La hora de publicación.',
                        'El país que lo publica.',
                      ],
                      1,
                      'El mercado ya había descontado lo esperado: reacciona a la sorpresa.',
                    ),
                    q(
                      'q2',
                      '¿Por qué un stop loss ajustado es especialmente arriesgado en el momento de una publicación?',
                      [
                        'Porque el proveedor deja de enviar precios.',
                        'Porque la volatilidad y el spread se amplían y pueden activarlo sin que la hipótesis falle.',
                        'Porque las órdenes no se ejecutan.',
                        'Porque el mercado cierra.',
                      ],
                      1,
                      'El ruido del momento puede recorrer una distancia mucho mayor de lo habitual.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'creacion-de-estrategias',
    title: 'Creación de una estrategia',
    summary: 'De un conjunto de ideas sueltas a un sistema de reglas evaluable.',
    level: 'AVANZADO',
    topic: 'estrategia',
    icon: 'workflow',
    minPlan: 'STANDARD',
    courses: [
      {
        slug: 'estrategia',
        title: 'Diseño de estrategias',
        summary: 'Reglas explícitas, medibles y repetibles.',
        minPlan: 'STANDARD',
        modules: [
          {
            slug: 'diseno',
            title: 'Diseño y validación',
            lessons: [
              {
                slug: 'anatomia-de-una-estrategia',
                title: 'Anatomía de una estrategia',
                summary: 'Seis componentes que deben estar escritos antes de la primera operación.',
                estimatedMinutes: 12,
                minPlan: 'STANDARD',
                topic: 'estrategia',
                blocks: [
                  {
                    type: 'text',
                    body: 'Una estrategia no es una idea sobre el mercado. Es un conjunto de reglas tan explícitas que otra persona podría aplicarlas y obtener las mismas decisiones que tú.',
                  },
                  {
                    type: 'checklist',
                    title: 'Los seis componentes obligatorios',
                    body: '',
                    items: [
                      'Universo: qué instrumentos y en qué temporalidad.',
                      'Condición de entrada: qué debe ocurrir exactamente para abrir.',
                      'Invalidación: qué demuestra que la idea era incorrecta.',
                      'Objetivo: dónde se cumple la hipótesis.',
                      'Dimensionado: cuánto riesgo por operación y cómo se calcula el tamaño.',
                      'Condición de no operar: cuándo te mantienes fuera aunque se cumpla la entrada.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'El componente que casi nadie escribe',
                    body: 'La condición de no operar. Sin ella, cualquier estrategia acaba aplicándose en contextos para los que no fue diseñada, y la culpa se atribuye a la estrategia.',
                  },
                  {
                    type: 'text',
                    title: 'Cuántas operaciones hacen falta',
                    body: 'Con menos de treinta repeticiones no puedes concluir prácticamente nada. Con cien empiezas a poder distinguir señal de ruido. Esta es la razón por la que la plataforma insiste en el tamaño de muestra junto a cada porcentaje de aciertos: sin ese contexto, el número engaña.',
                  },
                  {
                    type: 'exercise',
                    title: 'Ejercicio',
                    body: 'Escribe tu estrategia con los seis componentes en la sección de estrategias de la plataforma. Después aplícala en veinte simulaciones consecutivas sin modificarla, etiquetándolas todas con el mismo nombre. Al terminar, revisa el análisis por estrategia en tus estadísticas.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuál es el componente que con más frecuencia se omite?',
                      ['La condición de entrada', 'El objetivo', 'La condición de no operar', 'El universo'],
                      2,
                      'Sin saber cuándo abstenerse, la estrategia se aplica en contextos para los que no fue diseñada.',
                    ),
                    q(
                      'q2',
                      '¿A partir de cuántas repeticiones empieza a ser razonable evaluar una estrategia?',
                      ['5', '10', '30 como mínimo, preferiblemente 100', 'Basta con una si es clara'],
                      2,
                      'Por debajo de treinta operaciones el resultado está dominado por el azar de corto plazo.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'backtesting',
    title: 'Backtesting',
    summary: 'Probar una idea contra el pasado sin engañarte a ti mismo.',
    level: 'AVANZADO',
    topic: 'estrategia',
    icon: 'history',
    minPlan: 'STANDARD',
    courses: [
      {
        slug: 'backtesting-curso',
        title: 'Backtesting responsable',
        summary: 'Las trampas metodológicas más comunes.',
        minPlan: 'STANDARD',
        modules: [
          {
            slug: 'metodologia',
            title: 'Metodología',
            lessons: [
              {
                slug: 'trampas-del-backtesting',
                title: 'Las cuatro trampas del backtesting',
                summary: 'Sesgo de supervivencia, mirada al futuro, sobreajuste y costes ignorados.',
                estimatedMinutes: 10,
                minPlan: 'STANDARD',
                topic: 'estrategia',
                blocks: [
                  {
                    type: 'text',
                    title: '1. Mirada al futuro',
                    body: 'Usar información que no estaba disponible en el momento de la decisión. Es el error más frecuente y el más difícil de detectar: basta con calcular un indicador con el cierre de la vela en la que se supone que entraste.',
                  },
                  {
                    type: 'text',
                    title: '2. Sobreajuste',
                    body: 'Ajustar los parámetros hasta que el resultado histórico sea excelente. Si probaste doscientas combinaciones y elegiste la mejor, has encontrado la que mejor describe el ruido pasado, no la que mejor funcionará mañana.',
                  },
                  {
                    type: 'text',
                    title: '3. Costes ignorados',
                    body: 'Un sistema con cien operaciones diarias y un resultado teórico positivo puede ser claramente negativo al incorporar spread y deslizamiento. Los costes no son un detalle: para estrategias de alta frecuencia son el factor determinante.',
                  },
                  {
                    type: 'text',
                    title: '4. Sesgo de supervivencia',
                    body: 'Probar una estrategia sobre los activos que hoy existen ignora los que desaparecieron. El resultado queda inflado por construcción.',
                  },
                  {
                    type: 'callout',
                    tone: 'warning',
                    title: 'La prueba honesta',
                    body: 'Divide el histórico en dos: diseña con la primera mitad y valida con la segunda, sin volver atrás a retocar. Si el resultado se desploma en la segunda mitad, tenías sobreajuste.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      'Has probado 200 combinaciones de parámetros y eliges la mejor. ¿Qué problema tienes?',
                      ['Mirada al futuro', 'Sobreajuste', 'Sesgo de supervivencia', 'Costes ignorados'],
                      1,
                      'Con suficientes intentos siempre aparece una combinación que describe bien el ruido histórico.',
                    ),
                    q(
                      'q2',
                      '¿Cómo se detecta el sobreajuste?',
                      [
                        'Aumentando el número de operaciones.',
                        'Validando sobre un periodo que no se usó para diseñar.',
                        'Añadiendo más indicadores.',
                        'Reduciendo el tamaño de posición.',
                      ],
                      1,
                      'La validación fuera de muestra es la prueba estándar.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  {
    slug: 'prevencion-del-fraude',
    title: 'Prevención de fraudes financieros',
    summary: 'Reconocer una estafa antes de entregar dinero o datos.',
    level: 'BASICO',
    topic: 'prevencion-del-fraude',
    icon: 'shield-alert',
    minPlan: 'FREE',
    courses: [
      {
        slug: 'fraude',
        title: 'Protección del estudiante',
        summary: 'Señales, mecanismos y qué hacer.',
        minPlan: 'FREE',
        modules: [
          {
            slug: 'senales',
            title: 'Señales y verificación',
            lessons: [
              {
                slug: 'como-detectar-un-fraude',
                title: 'Cómo detectar un fraude financiero',
                summary: 'Nueve señales, el mecanismo psicológico que las hace funcionar y cómo verificar una entidad.',
                estimatedMinutes: 10,
                minPlan: 'FREE',
                topic: 'prevencion-del-fraude',
                blocks: [
                  {
                    type: 'text',
                    body: 'El fraude financiero rara vez parece un fraude. Suele presentarse con apariencia profesional, testimonios convincentes y una historia que encaja con lo que ya querías creer.',
                  },
                  {
                    type: 'checklist',
                    title: 'Nueve señales de alarma',
                    body: '',
                    items: [
                      'Prometen una rentabilidad fija y elevada. En mercados reales el rendimiento no es fijo.',
                      'Insisten en que «no hay riesgo». Todo rendimiento por encima del tipo libre de riesgo implica riesgo.',
                      'Presionan para decidir hoy: cupos limitados, precio que sube mañana.',
                      'La rentabilidad depende de traer a otras personas: es una estructura piramidal.',
                      'No puedes identificar al regulador que los supervisa, o citan uno que no los cubre.',
                      'El retiro de fondos tiene condiciones cambiantes o comisiones sorpresa.',
                      'Muestran capturas de pantalla como prueba de rentabilidad. Una captura no es una auditoría.',
                      'Usan la imagen de una persona conocida sin evidencia de relación real.',
                      'El primer contacto llegó por mensaje directo no solicitado.',
                    ],
                  },
                  {
                    type: 'callout',
                    tone: 'danger',
                    title: 'El mecanismo',
                    body: 'Casi todos los fraudes combinan urgencia y prueba social. La urgencia impide verificar; la prueba social sustituye la verificación por confianza. Si notas que te están apurando, esa es la señal, independientemente de lo demás.',
                  },
                  {
                    type: 'text',
                    title: 'Cómo verificar',
                    body: 'Busca el nombre de la entidad en el registro público del organismo supervisor de tu país. Comprueba que el número de registro corresponde a la actividad que dicen realizar. Desconfía si el nombre se parece mucho al de una entidad conocida.\n\nY una regla práctica: si alguien se molesta porque verificas, ya tienes tu respuesta.',
                  },
                  {
                    type: 'callout',
                    tone: 'info',
                    title: 'Sobre TradingLab',
                    body: 'Esta plataforma no recibe dinero para inversión, no admite depósitos de capital de trading y no permite retiros. Si alguien te contacta diciendo representarnos y te pide dinero para invertir, es un fraude. Repórtalo desde el centro de ayuda.',
                  },
                ],
                quiz: {
                  questions: [
                    q(
                      'q1',
                      '¿Cuál es la señal más determinante de un fraude?',
                      [
                        'Que la web tenga buen diseño.',
                        'Que prometan rentabilidad fija y elevada sin riesgo.',
                        'Que tengan presencia en redes sociales.',
                        'Que ofrezcan atención en español.',
                      ],
                      1,
                      'La combinación de rentabilidad alta, fija y sin riesgo es imposible en mercados reales.',
                    ),
                    q(
                      'q2',
                      'Te presionan para decidir hoy porque «quedan pocas plazas». ¿Qué deberías hacer?',
                      [
                        'Decidir rápido para no perder la oportunidad.',
                        'Detenerte: la urgencia existe para impedir que verifiques.',
                        'Pedir un descuento.',
                        'Invertir una cantidad pequeña para probar.',
                      ],
                      1,
                      'La urgencia artificial es una técnica para evitar la verificación, no una característica del producto.',
                    ),
                    q(
                      'q3',
                      'La rentabilidad depende de que traigas nuevos participantes. Eso es...',
                      ['Marketing de afiliación legítimo', 'Una estructura piramidal', 'Un programa de fidelidad', 'Un fondo indexado'],
                      1,
                      'Cuando el rendimiento procede de las aportaciones de nuevos entrantes y no de una actividad económica real, es una pirámide.',
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  },
];

/** Aplanado útil para el catálogo de lecciones que se ofrece a la IA. */
export function allLessons(): Array<{ slug: string; title: string; topic: string; trackSlug: string }> {
  const out: Array<{ slug: string; title: string; topic: string; trackSlug: string }> = [];
  for (const track of TRACKS) {
    for (const course of track.courses) {
      for (const mod of course.modules) {
        for (const lesson of mod.lessons) {
          out.push({ slug: lesson.slug, title: lesson.title, topic: lesson.topic, trackSlug: track.slug });
        }
      }
    }
  }
  return out;
}

export function trackStats(track: TrackSeed): { lessons: number; minutes: number } {
  let lessons = 0;
  let minutes = 0;
  for (const c of track.courses) {
    for (const m of c.modules) {
      for (const l of m.lessons) {
        lessons++;
        minutes += l.estimatedMinutes;
      }
    }
  }
  return { lessons, minutes };
}
