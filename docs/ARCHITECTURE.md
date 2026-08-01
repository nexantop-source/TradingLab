# Arquitectura

## Principio rector

El grafo de dependencias es acíclico y va en una sola dirección:

```
app/  ──▶  lib/  ──▶  packages/
                        └─ types/ (raíz: no importa nada)
```

Los paquetes no conocen la aplicación. `lib/` orquesta y toca la base de datos. `app/` solo
presenta. Esto tiene una consecuencia práctica importante: **el motor de simulación se puede probar,
auditar y portar sin arrancar Next.js ni una base de datos**, porque es una función pura.

## Módulos

| Módulo | Responsabilidad | Depende de |
|---|---|---|
| `packages/types` | Contratos de dominio, matriz de planes, textos de cumplimiento | — |
| `packages/market-data` | Interfaz de proveedores, motor determinístico, indicadores, calendario | `types` |
| `packages/simulation-engine` | Apertura, cierre, disparos, libro mayor, estadísticas educativas | `types` |
| `packages/ai` | Esquema estructurado, prompts versionados, guardarraíles, cliente, respaldo | `types` |
| `packages/ads` | Selección de anuncios, revisión de creatividades, inventario, paquetes | `types` |
| `packages/analytics` | Catálogo de eventos y definición de métricas del negocio | — |
| `packages/ui` | Sistema de diseño, gráfico propio, componentes de cumplimiento | `types`, `market-data` |
| `lib/` | Autenticación, RBAC, derechos de plan, servicios, facturación, analítica | todo lo anterior |
| `content/` | Academia, glosario, gamificación, evaluación inicial, textos legales | `types` |
| `app/` | Rutas, páginas y endpoints | todo lo anterior |

### Por qué no un monorepo con paquetes publicados

El pliego sugiere `apps/web`, `apps/api` y `packages/*` como paquetes de npm. Aquí los módulos están
en `src/packages/` con alias de TypeScript, lo que da la misma separación de responsabilidades sin
el coste operativo de gestionar versiones entre paquetes durante el desarrollo inicial.

Extraerlos a un monorepo real cuando haga falta es mecánico: cada carpeta de `src/packages/` ya
tiene sus dependencias declaradas por importación y ningún ciclo. El paso sería añadir un
`package.json` por carpeta y sustituir los alias del `tsconfig.json` por `workspaces`. La separación
`apps/web` / `apps/api` se justifica cuando la API tenga consumidores distintos del web (las
aplicaciones móviles de la tercera fase); mientras tanto, las route handlers de Next.js cumplen el
mismo papel con menos infraestructura.

---

## El motor de simulación

Es la pieza que un auditor querrá revisar primero, así que está construida para ser revisable.

### Determinismo

`packages/market-data/deterministic.ts` genera el precio de un instrumento en un instante mediante
ruido fractal sembrado por el símbolo. Propiedades:

- `priceAt(símbolo, t)` devuelve **siempre** el mismo valor.
- No hay estado, ni base de datos, ni `Math.random()`, ni `Date.now()` dentro del cálculo.
- Las velas se construyen submuestreando el intervalo, así que `h ≥ max(o,c)` y `l ≤ min(o,c)` se
  cumplen por construcción, no por corrección posterior.

`packages/simulation-engine/engine.ts` recibe todos los instantes como parámetro. No lee el reloj.
Liquidar un vencimiento a las 12:00:03 o a las 12:05 da el mismo resultado, porque usa el precio del
instante de vencimiento.

### Qué se congela al abrir una simulación

```
SimulationContextSnapshot {
  engineVersion        versión del motor que la abrió
  timeframe            temporalidad visible
  visibleIndicators    qué indicadores tenía el estudiante en pantalla
  indicatorValues      sus valores exactos, calculados por el backend
  provenance           proveedor, marca temporal, latencia, estado del mercado
  userTimezone         zona horaria del estudiante
  chartType            tipo de gráfico
  recentCandles        últimas 60 velas, para reconstruir el contexto
}
```

Más, en columnas propias: precio de entrada y salida, proveedor y marca temporal de cada uno,
latencia de cada uno, niveles, comisión, motivo escrito, confianza declarada y riesgo percibido.

Al cerrar se añade `settlementAudit`: la traza línea a línea del cálculo.

### Reglas duras del motor

- **La pérdida máxima es el margen comprometido.** `settlementCents` nunca es negativo. No hay
  deuda, no hay llamadas de margen que endeuden al estudiante.
- **Criterio conservador en la ambigüedad.** Si dentro de una misma vela se tocan stop loss y take
  profit, se asume que se ejecutó primero el stop loss. Una vela no conserva el orden temporal
  interno, así que se elige la hipótesis prudente y se documenta en la interfaz.
- **El spread se cobra dos veces y se ve.** Al abrir, el precio se sitúa en el lado desfavorable
  *y* se registra una comisión explícita. Así el estudiante ve las dos formas en que un coste de
  transacción aparece en la práctica.
- **El modo hipótesis normaliza por volatilidad.** Un 0,1 % en EUR/USD y un 0,1 % en Bitcoin no
  significan lo mismo. El resultado se calcula sobre el movimiento dividido por el ATR relativo, con
  tope, para que el aprendizaje sea sobre el mercado y no sobre una mecánica de pago fijo.

### El libro mayor

`DemoAccount.balanceCents` es un valor derivado. La verdad está en `DemoBalanceLedger`: cada fila
tiene delta, saldo resultante, motivo, referencia y nota. `verifyLedger` recalcula desde cero y
compara; el panel administrativo lo ejecuta sobre una muestra en cada carga.

Toda escritura pasa por `lib/demo-account.ts`, en transacción. Si un asiento dejaría el saldo en
negativo, se lanza `LedgerError` y no se escribe nada.

---

## La capa de inteligencia artificial

```
  Estudiante
     │ pregunta (texto libre)
     ▼
  /api/ai/analysis
     ├── requireAuth + límite del plan + limitación de frecuencia
     ├── sanitizeUserInput  (neutraliza inyección de instrucciones)
     ├── moderateInput      (moderación del proveedor)
     ├── Backend calcula precios e indicadores  ◀── el modelo NO los calcula
     ├── buildContext       (solo mercado + texto del estudiante, sin datos personales)
     ├── callEducationalModel  con json_schema estricto
     ├── runGuardrails      ─── si falla ──▶ deterministicChartReview
     ├── enforceDisclaimer
     └── persiste: payload, motor, versión de prompt, informe, tokens, coste, latencia
```

### Qué recibe el modelo

Solo esto: símbolo, nombre, clase de activo, temporalidad, precio actual, variación, máximo y mínimo
del día, últimas 80 velas, indicadores **ya calculados**, procedencia del dato, eventos económicos
próximos y el texto que el propio estudiante escribió, saneado.

No recibe: identificadores, nombre, correo, país, plan, historial ni saldo.

### Los guardarraíles

`packages/ai/guardrails.ts` analiza cada respuesta, incluida la del motor determinístico. Bloquea:

| Categoría | Ejemplos detectados |
|---|---|
| Expresiones prohibidas | «ganancia segura», «rentabilidad asegurada», «dinero fácil», «sin riesgo» |
| Órdenes imperativas | «compra EUR/USD ahora», «deberías vender», «te recomiendo comprar» |
| Certeza sobre el futuro | «va a subir», «sin duda», «siempre sube», «100 % de acierto» |
| Riesgo personal | inducir a endeudarse, usar dinero de necesidades básicas, martingala |
| Suplantación | presentarse como asesor financiero autorizado |
| Estructura | falta de riesgos, de invalidación, de incertidumbre o análisis unilateral |
| Fabricación | lecturas de indicador que no coinciden con el contexto entregado |

Las violaciones `BLOCK` impiden mostrar la respuesta. Las `FLAG` la marcan para revisión en
`/admin/ia` sin bloquearla.

### Degradación deliberada

Sin credencial, con el tope de coste alcanzado, con el proveedor caído o con una respuesta que no
supera los controles, se sirve el análisis determinístico. **Siempre se indica al usuario qué motor
lo generó.** Un tope de gasto no debe traducirse en una funcionalidad rota ni en un engaño.

---

## Datos de mercado

Todo pasa por la interfaz `MarketDataProvider`. La aplicación nunca habla con un proveedor concreto.

```ts
interface MarketDataProvider {
  id; label; declaredDelaySeconds; synthetic; attribution;
  getQuote(symbol, at?)
  getQuotes(symbols[], at?)
  getCandles({ symbol, timeframe, limit, to? })
  getPriceAt(symbol, timestampMs)     // usado por el motor para liquidar
  getMarketStatus(symbol, at?)
  search(query, limit?)
  getMeta(symbol)
  healthCheck()
}
```

Toda respuesta arrastra `DataProvenance`: proveedor, marca temporal de la fuente, marca temporal de
recepción, latencia, frescura, estado del mercado, divisa, si es sintético y el aviso legal
correspondiente. La interfaz lo muestra en `DataProvenanceBadge`, siempre visible.

Cambiar de proveedor: ver [`MARKET_DATA.md`](./MARKET_DATA.md).

---

## Autenticación y autorización

**Sesión.** Cookie httpOnly, sameSite lax, secure en producción, con dos partes: un JWT firmado que
contiene el identificador de sesión, y un token aleatorio del que solo se guarda el hash SHA-256. El
JWT permite validar sin ir a base de datos; la fila `Session` permite revocar. Una filtración de la
base de datos no permite suplantar sesiones.

**Autorización.** `lib/rbac.ts` define 28 permisos con forma `recurso:acción` y los asigna a ocho
roles. No hay herencia implícita: si un rol necesita un permiso, se escribe en su lista. Cada
sección administrativa declara el permiso que la protege.

**Derechos de plan.** `lib/entitlements.ts` los comprueba en el servidor, en cada endpoint. La
interfaz también oculta lo que un plan no incluye, pero eso es cortesía, no seguridad.

---

## Base de datos

47 modelos. SQLite en desarrollo, PostgreSQL en producción. El esquema es deliberadamente portable:
los campos enumerados son `String` con los valores válidos tipados en `packages/types`, y los campos
JSON son `String` serializado con los ayudantes de `lib/json.ts`.

Índices en los caminos calientes: `Simulation(userId, openedAt)`, `DemoBalanceLedger(demoAccountId,
createdAt)`, `AdImpression(campaignId, day)` y `AdImpression(userId, day)` para el frequency
capping, `Session(expiresAt)` para la limpieza.

---

## Rendimiento

- La landing se regenera cada 60 segundos (`revalidate = 60`).
- Las páginas de producto son dinámicas: dependen de la sesión.
- Los indicadores se calculan en el servidor una vez y se envían resueltos.
- El gráfico dibuja sobre canvas con `requestAnimationFrame` implícito del navegador y solo
  redibuja cuando cambian los datos, la ventana visible, el cursor o el tema.
- La terminal refresca cotizaciones cada 15 segundos. Para tiempo real de verdad, el punto de
  extensión es un WebSocket que sustituya ese intervalo; la interfaz ya está preparada porque toda
  la lectura pasa por el mismo estado.
