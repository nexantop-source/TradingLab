/**
 * Noticias educativas.
 *
 * IMPORTANTE: esta implementación **no inventa noticias de actualidad**. Sirve
 * artículos educativos redactados por el equipo de contenidos, atemporales,
 * que explican cómo leer un tipo de noticia. Están marcados como
 * `kind: 'EDUCATIONAL'`.
 *
 * Cuando se contrate un proveedor de noticias con licencia, se implementa
 * `NewsProvider` y los artículos de actualidad llegan con `kind: 'MARKET'`,
 * su fuente, su URL original y su marca temporal. La interfaz ya distingue
 * ambos casos.
 */

export interface NewsArticle {
  id: string;
  slug: string;
  kind: 'EDUCATIONAL' | 'MARKET';
  title: string;
  summary: string;
  body: string;
  /** Fuente. Para contenido propio, "Equipo educativo TradingLab". */
  source: string;
  sourceUrl: string | null;
  publishedAt: string;
  tags: string[];
  relatedSymbols: string[];
  readingMinutes: number;
}

export const EDUCATIONAL_NEWS: NewsArticle[] = [
  {
    id: 'news-001',
    slug: 'como-leer-un-dato-de-inflacion',
    kind: 'EDUCATIONAL',
    title: 'Cómo leer un dato de inflación sin reaccionar de más',
    summary:
      'La cifra que titula la noticia rara vez es la que mueve al mercado. Aprende a separar el dato general del subyacente y a comparar contra lo esperado.',
    body: `Cuando se publica un dato de inflación aparecen al menos tres números: la variación mensual, la interanual y la subyacente, que excluye alimentos y energía por ser los componentes más volátiles.

El mercado no reacciona al número en sí, sino a la diferencia entre el dato publicado y el dato esperado por el consenso de analistas. Un 3,2 % puede ser una sorpresa alcista o bajista según qué se esperaba.

Qué observar como estudiante:

1. La sorpresa respecto al consenso, no el valor absoluto.
2. La tendencia de los últimos tres a seis meses.
3. La composición: si la subyacente no baja, el dato general puede engañar.
4. La reacción del mercado en los primeros minutos suele revertirse parcialmente. Muchos operadores con experiencia esperan a que se asiente.

Un ejercicio útil: antes de la publicación, escribe en tu diario qué esperas y qué harías en cada escenario. Después compara tu plan con lo que hiciste realmente. Esa distancia es tu área de mejora, mucho más que el resultado de la operación.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-01-20T09:00:00.000Z',
    tags: ['análisis fundamental', 'macroeconomía'],
    relatedSymbols: ['EURUSD', 'XAUUSD', 'SPX500'],
    readingMinutes: 4,
  },
  {
    id: 'news-002',
    slug: 'diferencial-de-tipos-y-divisas',
    kind: 'EDUCATIONAL',
    title: 'Por qué el diferencial de tipos mueve a las divisas',
    summary:
      'Una divisa no sube porque su país «vaya bien». Entiende el mecanismo del diferencial de tipos de interés y sus límites.',
    body: `Cuando un banco central sube los tipos de interés, los activos denominados en su divisa ofrecen, en igualdad de condiciones, una remuneración mayor. Eso tiende a atraer capital y a apreciar la divisa.

La palabra clave es «tiende». El mecanismo tiene excepciones importantes:

- El mercado descuenta expectativas. Si una subida ya se esperaba, puede no mover el precio.
- El riesgo país puede más que el tipo de interés. Una divisa con tipos altos y riesgo elevado puede depreciarse.
- En episodios de aversión al riesgo, el capital busca refugio y ignora los diferenciales.

Aplicación práctica: cuando estudies un par como el EUR/USD, no mires solo qué hace el Banco Central Europeo. Mira la diferencia entre lo que se espera del BCE y lo que se espera de la Reserva Federal. Esa diferencia esperada, y no el nivel actual, es la que suele explicar el movimiento.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-01-22T09:00:00.000Z',
    tags: ['forex', 'bancos centrales'],
    relatedSymbols: ['EURUSD', 'USDJPY', 'GBPUSD'],
    readingMinutes: 3,
  },
  {
    id: 'news-003',
    slug: 'senales-de-fraude-financiero',
    kind: 'EDUCATIONAL',
    title: 'Nueve señales de que una propuesta financiera es un fraude',
    summary:
      'Rentabilidad fija y alta, presión para decidir rápido y estructura de referidos. Una lista de verificación para protegerte.',
    body: `El fraude financiero rara vez se presenta como tal. Suele venir envuelto en apariencia profesional. Estas señales, especialmente combinadas, deben detenerte:

1. Prometen una rentabilidad fija y elevada. En mercados reales el rendimiento no es fijo.
2. Insisten en que «no hay riesgo». Todo rendimiento superior al tipo libre de riesgo implica riesgo.
3. Presionan para decidir hoy: cupos limitados, precio que sube mañana.
4. La rentabilidad depende de traer a otras personas. Eso es una estructura piramidal.
5. No puedes identificar al regulador que los supervisa, o citan uno que no los cubre.
6. El retiro de fondos tiene condiciones cambiantes o comisiones sorpresa.
7. Muestran capturas de pantalla de ganancias como prueba. Una captura no es una auditoría.
8. Usan la imagen de una persona conocida sin evidencia de relación real.
9. El contacto llegó por mensaje directo no solicitado.

Qué hacer: verifica siempre el registro de la entidad en el organismo supervisor de tu país antes de entregar dinero o datos. Si alguien se molesta porque verificas, ya tienes tu respuesta.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-01-25T09:00:00.000Z',
    tags: ['prevención del fraude', 'seguridad'],
    relatedSymbols: [],
    readingMinutes: 4,
  },
  {
    id: 'news-004',
    slug: 'apalancamiento-que-significa-realmente',
    kind: 'EDUCATIONAL',
    title: 'Qué significa realmente el apalancamiento',
    summary:
      'El apalancamiento no multiplica tus aciertos: multiplica el tamaño de tu posición, y con él tu exposición al error.',
    body: `Con apalancamiento 1:100, USD 100 controlan una posición de USD 10.000. Es tentador leerlo como «gano cien veces más». La lectura correcta es «un movimiento del 1 % en contra consume el 100 % de mi garantía».

Tres consecuencias que conviene interiorizar:

- El apalancamiento no cambia la probabilidad de acertar. Solo cambia cuánto te cuesta equivocarte.
- Reduce el margen de maniobra: movimientos normales de mercado pueden cerrarte la posición antes de que tu hipótesis tenga tiempo de desarrollarse.
- Interactúa con el tamaño de posición. Dos personas con el mismo apalancamiento pueden tener riesgos totalmente distintos según cuánto arriesguen por operación.

En esta plataforma el apalancamiento es exclusivamente simulado y existe para que veas su efecto sobre el resultado sin que te cueste dinero. Usa el modo de posición simulada para comparar la misma hipótesis con 1:1, 1:10 y 1:100, y observa qué le pasa a tu saldo virtual.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-01-28T09:00:00.000Z',
    tags: ['gestión del riesgo', 'apalancamiento'],
    relatedSymbols: ['EURUSD', 'BTCUSD'],
    readingMinutes: 3,
  },
  {
    id: 'news-005',
    slug: 'volumen-y-volatilidad-no-son-lo-mismo',
    kind: 'EDUCATIONAL',
    title: 'Volumen y volatilidad no son lo mismo',
    summary: 'Dos conceptos que suelen confundirse y que responden preguntas distintas sobre el mercado.',
    body: `El volumen responde a «cuánto se negoció». La volatilidad responde a «cuánto se movió el precio».

Pueden ir juntos, pero no siempre. Un mercado puede moverse mucho con poco volumen, típicamente en horarios de baja participación, y ese movimiento suele ser menos fiable. También puede negociarse mucho sin que el precio avance, lo que sugiere que compradores y vendedores están equilibrados en esa zona.

Herramientas para cada pregunta:

- Para volumen: el histograma de volumen y el VWAP.
- Para volatilidad: el ATR y la amplitud de las bandas de Bollinger.

Un error frecuente del principiante es usar el ATR como si indicara dirección. No lo hace: un ATR alto significa que el precio se mueve mucho, en cualquier sentido. Su utilidad real es dimensionar el stop loss y el tamaño de la posición.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-02-02T09:00:00.000Z',
    tags: ['análisis técnico', 'indicadores'],
    relatedSymbols: ['BTCUSD', 'SPX500'],
    readingMinutes: 3,
  },
  {
    id: 'news-006',
    slug: 'por-que-tu-diario-vale-mas-que-tu-resultado',
    kind: 'EDUCATIONAL',
    title: 'Por qué tu diario vale más que tu resultado',
    summary:
      'En una muestra pequeña, el resultado es ruido. El registro de tus decisiones es la única señal disponible.',
    body: `Con diez operaciones no puedes distinguir una buena estrategia de una racha afortunada. Con cien empiezas a poder. La mayoría de las personas abandona mucho antes de llegar a esa muestra, y lo hace juzgándose por el resultado.

El diario cambia la unidad de medida. En lugar de preguntarte «¿gané?», te permite preguntarte:

- ¿Definí antes de entrar qué invalidaría mi hipótesis?
- ¿Respeté el tamaño de posición que había planificado?
- ¿Entré por la razón que había escrito, o por impaciencia?
- ¿Moví el stop loss durante la operación? ¿Por qué?

Estas preguntas tienen respuesta objetiva incluso en una muestra pequeña. Y son las que puedes mejorar deliberadamente. El resultado, en cambio, depende en parte del azar de corto plazo, que no controlas.

Recomendación concreta: registra la emoción antes y después de cada simulación. Al cabo de un mes, filtra el diario por «impaciente» y compara la calidad de esas decisiones con las tomadas en estado «enfocado». El patrón suele ser evidente.`,
    source: 'Equipo educativo TradingLab',
    sourceUrl: null,
    publishedAt: '2026-02-05T09:00:00.000Z',
    tags: ['psicología', 'disciplina'],
    relatedSymbols: [],
    readingMinutes: 4,
  },
];

export function listNews(params?: { symbol?: string; tag?: string; limit?: number }): NewsArticle[] {
  let items = [...EDUCATIONAL_NEWS];
  if (params?.symbol) {
    const s = params.symbol.toUpperCase();
    items = items.filter((n) => n.relatedSymbols.includes(s));
  }
  if (params?.tag) items = items.filter((n) => n.tags.includes(params.tag!));
  items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return params?.limit ? items.slice(0, params.limit) : items;
}

export function getNews(slug: string): NewsArticle | undefined {
  return EDUCATIONAL_NEWS.find((n) => n.slug === slug);
}
