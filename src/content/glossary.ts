/** Glosario educativo. Se carga en la semilla y se edita desde el CMS. */

export interface GlossaryEntry {
  slug: string;
  term: string;
  definition: string;
  category: 'general' | 'tecnico' | 'riesgo' | 'forex' | 'cripto' | 'fundamental';
  related: string[];
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    slug: 'apalancamiento',
    term: 'Apalancamiento',
    definition:
      'Mecanismo que permite controlar una posición de tamaño superior al capital aportado como garantía. No modifica la probabilidad de acertar: modifica cuánto se gana o se pierde por cada movimiento del precio, y reduce el margen de maniobra antes de que la posición se cierre.',
    category: 'riesgo',
    related: ['margen', 'tamano-de-posicion', 'stop-loss'],
  },
  {
    slug: 'ask',
    term: 'Ask (precio de oferta)',
    definition: 'Precio al que puedes comprar en este instante. Siempre es igual o superior al bid; la diferencia entre ambos es el spread.',
    category: 'general',
    related: ['bid', 'spread'],
  },
  {
    slug: 'atr',
    term: 'ATR (rango verdadero medio)',
    definition:
      'Indicador que mide la amplitud media del movimiento de las últimas N velas. Mide volatilidad, no dirección. Su uso natural es dimensionar la distancia del stop loss y el tamaño de la posición.',
    category: 'tecnico',
    related: ['volatilidad', 'stop-loss'],
  },
  {
    slug: 'bid',
    term: 'Bid (precio de demanda)',
    definition: 'Precio al que puedes vender en este instante. Siempre es igual o inferior al ask.',
    category: 'general',
    related: ['ask', 'spread'],
  },
  {
    slug: 'backtesting',
    term: 'Backtesting',
    definition:
      'Prueba de una estrategia sobre datos históricos. Su utilidad depende por completo del rigor metodológico: sin validación fuera de muestra y sin incorporar costes de transacción, un buen resultado histórico no informa sobre el comportamiento futuro.',
    category: 'general',
    related: ['sobreajuste', 'estrategia'],
  },
  {
    slug: 'bandas-de-bollinger',
    term: 'Bandas de Bollinger',
    definition:
      'Dos bandas situadas a un número de desviaciones típicas por encima y por debajo de una media móvil. Describen el rango en el que el precio se ha movido recientemente. Su estrechamiento indica baja volatilidad, pero no anticipa la dirección de la siguiente ruptura.',
    category: 'tecnico',
    related: ['volatilidad', 'media-movil'],
  },
  {
    slug: 'divergencia',
    term: 'Divergencia',
    definition:
      'Situación en la que el precio marca un nuevo extremo pero un oscilador no lo acompaña. Es una observación que invita a buscar más evidencia, no una señal de giro por sí misma.',
    category: 'tecnico',
    related: ['rsi', 'macd'],
  },
  {
    slug: 'drawdown',
    term: 'Drawdown (caída máxima)',
    definition:
      'Descenso desde un máximo del saldo acumulado hasta el mínimo posterior. Es la medida más honesta del dolor de una estrategia, porque describe lo que hay que soportar para obtener el resultado final.',
    category: 'riesgo',
    related: ['gestion-del-riesgo'],
  },
  {
    slug: 'estrategia',
    term: 'Estrategia',
    definition:
      'Conjunto de reglas explícitas que determinan qué operar, cuándo entrar, qué invalida la idea, dónde está el objetivo, cuánto arriesgar y cuándo abstenerse. Si otra persona no puede aplicarlas y llegar a las mismas decisiones, todavía no es una estrategia.',
    category: 'general',
    related: ['backtesting', 'gestion-del-riesgo'],
  },
  {
    slug: 'gestion-del-riesgo',
    term: 'Gestión del riesgo',
    definition:
      'Conjunto de decisiones que determinan cuánto se puede perder: tamaño de posición, distancia del stop loss, exposición total y correlación entre posiciones. Es la única parte del resultado que se controla por completo.',
    category: 'riesgo',
    related: ['tamano-de-posicion', 'stop-loss', 'drawdown'],
  },
  {
    slug: 'liquidez',
    term: 'Liquidez',
    definition:
      'Facilidad para entrar o salir de una posición sin desplazar el precio en contra. A menor liquidez, mayor spread y mayor impacto de cada orden.',
    category: 'general',
    related: ['spread', 'volumen'],
  },
  {
    slug: 'macd',
    term: 'MACD',
    definition:
      'Diferencia entre dos medias móviles exponenciales, acompañada de una media de esa diferencia (la señal) y de un histograma. Describe cambios en el impulso; como toda herramienta derivada del precio, llega con retraso.',
    category: 'tecnico',
    related: ['media-movil', 'divergencia'],
  },
  {
    slug: 'margen',
    term: 'Margen',
    definition:
      'Garantía requerida para mantener abierta una posición apalancada. En TradingLab el margen es exclusivamente virtual y la pérdida máxima de una simulación es el importe comprometido: no existe deuda posible.',
    category: 'riesgo',
    related: ['apalancamiento'],
  },
  {
    slug: 'media-movil',
    term: 'Media móvil',
    definition:
      'Promedio del precio de los últimos N periodos. Filtra ruido a cambio de introducir retraso. Cuanto mayor el periodo, más estable y más tardía.',
    category: 'tecnico',
    related: ['macd', 'bandas-de-bollinger'],
  },
  {
    slug: 'pip',
    term: 'Pip',
    definition:
      'Unidad convencional mínima de variación en Forex. Equivale al cuarto decimal en la mayoría de pares y al segundo en los pares con yen.',
    category: 'forex',
    related: ['tamano-de-posicion'],
  },
  {
    slug: 'relacion-riesgo-beneficio',
    term: 'Relación riesgo-beneficio',
    definition:
      'Cociente entre el recorrido buscado y el riesgo asumido, medido con los niveles definidos antes de abrir. Una relación de 2 significa que se busca ganar el doble de lo que se arriesga.',
    category: 'riesgo',
    related: ['stop-loss', 'take-profit'],
  },
  {
    slug: 'rsi',
    term: 'RSI (índice de fuerza relativa)',
    definition:
      'Oscilador entre 0 y 100 que compara la magnitud de las subidas y las bajadas recientes. Una lectura alta indica que las subidas han sido intensas, no que el precio deba caer.',
    category: 'tecnico',
    related: ['divergencia', 'sobrecompra'],
  },
  {
    slug: 'sobreajuste',
    term: 'Sobreajuste',
    definition:
      'Ajustar los parámetros de una estrategia hasta describir con precisión el ruido de los datos históricos. Produce excelentes resultados pasados y un comportamiento pobre en datos nuevos.',
    category: 'general',
    related: ['backtesting'],
  },
  {
    slug: 'sobrecompra',
    term: 'Sobrecompra y sobreventa',
    definition:
      'Zonas convencionales de un oscilador que indican que el movimiento reciente ha sido intenso en un sentido. No implican un giro inminente: en tendencias fuertes pueden mantenerse durante semanas.',
    category: 'tecnico',
    related: ['rsi'],
  },
  {
    slug: 'soporte-y-resistencia',
    term: 'Soporte y resistencia',
    definition:
      'Zonas de precio donde históricamente ha aparecido interés comprador o vendedor suficiente para frenar el movimiento. Son rangos, no líneas exactas, y funcionan en parte porque muchos participantes las observan.',
    category: 'tecnico',
    related: ['estructura-de-precio'],
  },
  {
    slug: 'spread',
    term: 'Spread',
    definition:
      'Diferencia entre el precio de compra y el de venta. Es un coste de transacción implícito que se paga al abrir y al cerrar, y se amplía en momentos de baja liquidez o alta volatilidad.',
    category: 'general',
    related: ['bid', 'ask', 'liquidez'],
  },
  {
    slug: 'stop-loss',
    term: 'Stop loss',
    definition:
      'Nivel de precio en el que se cierra una posición para limitar la pérdida. Debe situarse donde la hipótesis queda invalidada, no donde resulte cómodo, y respetar la volatilidad normal del instrumento.',
    category: 'riesgo',
    related: ['take-profit', 'atr', 'gestion-del-riesgo'],
  },
  {
    slug: 'take-profit',
    term: 'Take profit',
    definition: 'Nivel de precio en el que se cierra una posición porque la hipótesis se ha cumplido y el recorrido esperado se agota.',
    category: 'riesgo',
    related: ['stop-loss', 'relacion-riesgo-beneficio'],
  },
  {
    slug: 'tamano-de-posicion',
    term: 'Tamaño de posición',
    definition:
      'Volumen de la operación. Es una consecuencia del riesgo aceptado y de la distancia al nivel de invalidación, nunca un punto de partida.',
    category: 'riesgo',
    related: ['gestion-del-riesgo', 'stop-loss'],
  },
  {
    slug: 'trailing-stop',
    term: 'Trailing stop',
    definition:
      'Stop loss que sigue al precio a una distancia fija cuando este se mueve a favor y permanece quieto cuando se mueve en contra. Protege beneficio acumulado a cambio de salidas más tempranas.',
    category: 'riesgo',
    related: ['stop-loss'],
  },
  {
    slug: 'volatilidad',
    term: 'Volatilidad',
    definition:
      'Magnitud de las variaciones del precio en un periodo. No indica dirección. A mayor volatilidad, menor debe ser el tamaño de posición para mantener constante el riesgo monetario.',
    category: 'riesgo',
    related: ['atr', 'tamano-de-posicion'],
  },
  {
    slug: 'volumen',
    term: 'Volumen',
    definition:
      'Cantidad negociada en un periodo. Responde a «cuánto se intercambió», no a «cuánto se movió el precio», que es la volatilidad.',
    category: 'general',
    related: ['liquidez', 'volatilidad'],
  },
  {
    slug: 'vwap',
    term: 'VWAP',
    definition:
      'Precio medio ponderado por volumen desde el inicio de la sesión. Sirve como referencia del precio al que se ha negociado realmente la mayor parte del volumen del día.',
    category: 'tecnico',
    related: ['volumen'],
  },
  {
    slug: 'estructura-de-precio',
    term: 'Estructura de precio',
    definition:
      'Secuencia de máximos y mínimos que describe la organización del movimiento. Máximos y mínimos crecientes describen una estructura alcista; decrecientes, una bajista.',
    category: 'tecnico',
    related: ['soporte-y-resistencia'],
  },
  {
    slug: 'diferencial-de-tipos',
    term: 'Diferencial de tipos de interés',
    definition:
      'Diferencia entre los tipos de interés de dos economías. Es uno de los factores que más influyen en la evolución de un par de divisas, aunque lo relevante suele ser el diferencial esperado, no el actual.',
    category: 'fundamental',
    related: ['forex'],
  },
];
