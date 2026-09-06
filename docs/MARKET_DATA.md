# Datos de mercado

## El contrato

La aplicación nunca habla con un proveedor concreto. Todo pasa por `MarketDataProvider`, definido en
`src/packages/market-data/provider.ts`.

```ts
interface MarketDataProvider {
  readonly id: string;                  // identificador estable, aparece en la auditoría
  readonly label: string;               // nombre mostrado al usuario
  readonly declaredDelaySeconds: number;// latencia del plan contratado
  readonly synthetic: boolean;          // true si no proviene de un mercado real
  readonly attribution: { text: string; url: string } | null;

  getQuote(symbol, at?): Promise<Quote>;
  getQuotes(symbols[], at?): Promise<Quote[]>;
  getCandles({ symbol, timeframe, limit, to? }): Promise<CandleSeries>;
  getPriceAt(symbol, timestampMs): Promise<{ price, provenance }>;
  getMarketStatus(symbol, at?): MarketStatus;
  search(query, limit?): Promise<AssetMeta[]>;
  getMeta(symbol): Promise<AssetMeta | null>;
  healthCheck(): Promise<{ ok, latencyMs, message }>;
}
```

`getPriceAt` es el más importante: el motor de simulación lo usa para liquidar. **Debe ser
reproducible**: la misma marca temporal tiene que devolver el mismo precio, o la auditoría deja de
tener sentido. Un proveedor real lo cumple consultando su histórico, no su cotización actual.

## Procedencia obligatoria

Toda respuesta arrastra `DataProvenance`:

```ts
{
  provider,          // identificador del proveedor
  providerLabel,     // nombre legible
  sourceTimestamp,   // cuándo generó el dato el proveedor
  receivedTimestamp, // cuándo lo recibimos
  latencyMs,         // latencia estimada extremo a extremo
  freshness,         // REALTIME | DELAYED | MARKET_CLOSED | STALE | SIMULATED
  marketStatus,      // OPEN | CLOSED | PRE_OPEN | HOLIDAY
  currency,
  synthetic,         // true si no es un mercado real
  notice,            // aviso mostrado al usuario
}
```

Esto no es opcional. `DataProvenanceBadge` lo muestra junto a cada gráfico y cada cotización, y cada
simulación lo congela en su contexto. El criterio de aceptación es explícito: la fuente y la latencia
del precio deben estar siempre visibles.

## Añadir un proveedor

### 1. Implementar

`src/packages/market-data/providers/twelvedata.ts`:

```ts
import type { MarketDataProvider } from '../provider';
import { MarketDataError } from '../provider';

export class TwelveDataProvider implements MarketDataProvider {
  readonly id = 'twelvedata';
  readonly label = 'Twelve Data';
  readonly declaredDelaySeconds = Number(process.env.MARKET_DATA_DELAY_SECONDS ?? '0');
  readonly synthetic = false;
  readonly attribution = { text: 'Datos por Twelve Data', url: 'https://twelvedata.com' };

  async getQuote(symbol: string) {
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${key}`);
    if (!res.ok) throw new MarketDataError('…', 'UPSTREAM', this.id);
    // Traducir al tipo Quote, rellenando DataProvenance con datos reales.
  }

  // … resto de métodos
}
```

Reglas al implementar:

- **No inventes la procedencia.** Si el proveedor no informa de su marca temporal, usa la de
  recepción y declara `freshness: 'DELAYED'` con la latencia del plan contratado.
- **Traduce los errores** a `MarketDataError` con su código: `UNKNOWN_SYMBOL`, `RATE_LIMITED`,
  `UPSTREAM` o `NOT_CONFIGURED`. La capa superior no debe conocer el formato de error del proveedor.
- **Respeta el límite de peticiones** del plan. Conviene una caché de corta duración para las
  cotizaciones de la lista de seguimiento.
- **Declara la atribución** si la licencia la exige. Nunca se oculta.

### 2. Registrar

En `src/packages/market-data/registry.ts`:

```ts
import { TwelveDataProvider } from './providers/twelvedata';

if (process.env.TWELVEDATA_API_KEY) {
  registerProvider(new TwelveDataProvider());
}
```

### 3. Activar

```bash
MARKET_DATA_PROVIDER=twelvedata
TWELVEDATA_API_KEY=…
MARKET_DATA_DELAY_SECONDS=0
```

Y añadir la fila correspondiente en `DataProviderRecord` para que aparezca en `/admin/datos`.

Si el proveedor configurado no está registrado —por ejemplo, falta la credencial—, `marketData()`
degrada al motor determinístico y lo deja registrado en el log. La aplicación sigue funcionando y la
interfaz indica la procedencia real.

## El motor determinístico incluido

`SyntheticMarketDataProvider` no es un simulacro barato: es una pieza deliberada.

**Cómo funciona.** `deterministic.ts` genera el precio mediante ruido fractal sembrado por el
símbolo, con tres escalas temporales —macro (meses), media (días) y micro (minutos)— combinadas en
un movimiento log-normal cuya volatilidad se calibra con la volatilidad anual declarada de cada
instrumento.

**Propiedades.**

- `priceAt(símbolo, t)` devuelve siempre el mismo valor. Sin estado, sin aleatoriedad, sin base de
  datos.
- Las velas se construyen submuestreando el intervalo: `h ≥ max(o,c)` y `l ≤ min(o,c)` se cumplen
  por construcción.
- El volumen tiene estacionalidad horaria y correlaciona con el rango de la vela.
- Respeta el calendario: fuera de sesión no se generan velas y el precio se congela en el último
  instante de mercado abierto.
- Declara `synthetic: true`, así que la interfaz siempre muestra el aviso correspondiente.

**Para qué sirve.** Desarrollo y pruebas sin credenciales, pruebas automatizadas reproducibles,
demostraciones sin coste de datos, y —lo más importante— **un entorno educativo donde el estudiante
puede verificar que el motor de simulación es correcto**, porque puede recalcular cualquier
resultado.

**Para qué no sirve.** No replica un mercado real y no debe presentarse como tal. Nunca se presenta
como tal.

## Calendario económico

`calendar.ts` genera de forma determinística los eventos macroeconómicos recurrentes a partir de su
periodicidad habitual: empleo no agrícola, IPC, decisiones de tipos, PMI, inventarios de crudo,
peticiones semanales de desempleo. Cada evento incluye una nota educativa que explica por qué
importa y qué instrumentos suelen verse afectados.

**Deliberadamente no incluye cifras publicadas ni previsiones de consenso.** Publicar esos datos
exige una licencia. Al conectar un proveedor de calendario, se implementa la misma interfaz y se
sustituye `getEconomicEvents`.

## Noticias

`news.ts` **no inventa noticias de actualidad**. Sirve artículos educativos atemporales redactados
por el equipo de contenidos, marcados con `kind: 'EDUCATIONAL'`, que explican cómo leer un tipo de
noticia en lugar de informar de un hecho concreto.

Al contratar un proveedor con licencia, los artículos de actualidad llegan con `kind: 'MARKET'`, su
fuente, su URL original y su marca temporal. La interfaz ya distingue ambos casos.

Esta decisión es intencionada: preferimos no mostrar nada antes que mostrar información sin
procedencia verificable en una plataforma cuyo propósito es enseñar a verificar.

## Política sobre bibliotecas de gráficos

El gráfico avanzado de TradingLab es una implementación propia sobre `<canvas>`; la terminal
simple utiliza SVG propio con observaciones autenticadas de la serie demo cada segundo
(`/api/market/pulse`). Ninguno usa una biblioteca gráfica de terceros. No hay ninguna atribución
obligatoria que alguien pueda sentir la tentación de ocultar.

Si en el futuro se adopta una biblioteca con licencia comercial:

1. Obtener la licencia que permita el uso comercial requerido.
2. Renderizar su atribución en el componente `ChartAttribution`, junto al gráfico y siempre visible.
3. **Nunca** ocultarla con CSS, opacidad, capas superpuestas o manipulación del DOM.

Limitar herramientas, dibujos o navegación desde la API del componente es legítimo. Tapar una
atribución obligatoria no lo es, y además es una violación de licencia.

## Universo de instrumentos

20 instrumentos en cinco clases de activo, definidos en `symbols.ts` con su precisión, tamaño de
tick, spread virtual calibrado según liquidez real, sesión de referencia, nivel de riesgo educativo
y plan mínimo.

| Clase | Instrumentos |
|---|---|
| Forex | EURUSD, GBPUSD, USDJPY, USDMXN, AUDUSD |
| Criptomonedas | BTCUSD, ETHUSD, SOLUSD, XRPUSD |
| Acciones | AAPL, MSFT, TSLA, NVDA, AMZN |
| Índices | SPX500, NAS100, GER40 |
| Commodities | XAUUSD, XAGUSD, WTIUSD |

Los ETF se incorporarán cuando exista una fuente de datos autorizada que los cubra con licencia
adecuada. La interfaz lo indica en lugar de simularlos.
