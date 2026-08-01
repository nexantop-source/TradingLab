# Contratos de API

Todas las respuestas siguen la misma forma:

```jsonc
// Éxito
{ "ok": true, "data": { ... } }

// Error
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

Los mensajes de error están redactados para mostrarse directamente al usuario final, en español y
sin jerga técnica. Los errores de validación incluyen `details` con `{ path, message }` por campo.

**Códigos de estado**: 200 correcto · 201 creado · 400 entrada inválida · 401 sin sesión ·
403 sin permiso o plan insuficiente · 404 no encontrado · 422 validación fallida ·
429 límite de frecuencia o de plan (con cabecera `Retry-After`) · 500 error interno · 503 IA no
disponible.

---

## Autenticación

### `POST /api/auth/register`

```jsonc
{
  "name": "Ana",
  "email": "ana@ejemplo.com",
  "password": "una frase larga y memorable",
  "countryCode": "ES",
  "timezone": "Europe/Madrid",
  "locale": "es",
  "acceptTerms": true,      // obligatorio
  "acceptRisk": true,       // obligatorio
  "confirmAge": true,       // obligatorio
  "marketingOptIn": false
}
```

→ `{ userId, demoBalanceCents: 1000000, next: "/onboarding" }`

Crea la cuenta, la cuenta DEMO con su asiento de apertura, el portafolio inicial, la lista de
seguimiento y **registra los consentimientos con la versión concreta del documento aceptado**.
Rechaza países restringidos en el servidor. Límite: 5 por hora y por IP.

### `POST /api/auth/login`

`{ email, password }` → `{ userId, next }`

Mensaje idéntico para correo inexistente y contraseña incorrecta: no revelamos si el correo existe.
Límite doble: por IP y por dirección de correo, 8 intentos cada 5 minutos.

### `POST /api/auth/logout`

Revoca la sesión actual y borra la cookie.

---

## Perfil

### `PATCH /api/me/preferences`

`{ theme?, reduceMotion?, highContrast?, locale?, timezone?, emailOptIn? }`

### `POST /api/me/onboarding`

```jsonc
{
  "experienceLevel": "PRINCIPIANTE",
  "marketInterests": ["FOREX", "CRYPTO"],
  "educationalGoal": "gestion-riesgo",
  "weeklyAvailability": 6,
  "assessmentAnswers": [2, 1, 1, 1, 1, 1, 0, 0]
}
```

→ `{ score, classification: { level, headline, recommendation, recommendedTrack }, rationales[] }`

La puntuación **se calcula en el servidor** a partir de los índices elegidos. El cliente nunca envía
la nota.

### `DELETE /api/me/sessions`

Revoca todas las sesiones salvo la actual. → `{ revoked: n }`

### `GET /api/me/export`

Descarga JSON con todos los datos del usuario, incluida la traza de auditoría de cada simulación.
Portabilidad conforme al RGPD.

---

## Datos de mercado

### `GET /api/market/quotes?symbols=EURUSD,BTCUSD`

→ `{ quotes: [{ symbol, price, bid, ask, change, changePercent, dayHigh, dayLow, previousClose, volume, provenance, name, assetClass, precision }] }`

### `GET /api/market/candles?symbol=EURUSD&timeframe=1h&limit=300&indicators=SMA20,RSI14`

→ `{ symbol, name, assetClass, precision, timeframe, candles[], provenance, indicators, indicatorSnapshot, unavailableIndicators[] }`

`unavailableIndicators` enumera los solicitados que el plan actual no incluye. El cálculo ocurre en
el servidor: es el mismo que alimenta a la IA.

### `GET /api/market/search?q=euro`

→ `{ results: [{ …metadatos, available, marketStatus }] }`

Los instrumentos fuera del plan se devuelven con `available: false` en lugar de ocultarse: esconder
el catálogo daría una impresión falsa de su tamaño.

### `GET /api/market/calendar?symbol=EURUSD&days=14&back=1`

→ `{ events: [{ id, time, country, countryCode, currency, title, impact, educationalNote, relatedSymbols, educational: true }], from, to }`

---

## Simulaciones

### `POST /api/simulations`

Unión discriminada por `mode`. Campos comunes: `symbol`, `stakeCents`, `rationale` (mínimo 15
caracteres), `confidence`, `perceivedRisk` (1-5), `timeframe`, `visibleIndicators[]`, `chartType`,
`acknowledgedSimulation: true` (obligatorio).

```jsonc
// Modo hipótesis — disponible en todos los planes
{ "mode": "HYPOTHESIS", "direction": "BULLISH", "durationMinutes": 60, … }

// Modo posición — desde el plan Standard
{ "mode": "POSITION", "direction": "BULLISH", "orderType": "MARKET", "limitPrice": null,
  "leverage": 10, "stopLoss": 1.0835, "takeProfit": 1.0925, "trailingStopDistance": null, … }

// Modo portafolio — desde el plan Standard
{ "mode": "PORTFOLIO", "portfolioId": "…", "side": "BUY", … }
```

→ `201 { simulationId, entryPrice, quantity, feeCents, balanceCents, expiresAt, provenance }`

Comprueba, en este orden: modo permitido por el plan, límite diario, instrumento permitido, mercado
abierto, coherencia de niveles, saldo suficiente. Congela el contexto y registra dos asientos:
retención de margen y comisión.

### `GET /api/simulations?status=all&limit=50`

Liquida vencimientos y disparos antes de responder, para que la vista sea coherente con el estado
real. → `{ open[], closed[], historyCutoff }`

### `POST /api/simulations/:id/close`

`{ fraction: 1 }` → `{ simulationId, exitPrice, pnlCents, outcome, closeReason, balanceCents, returnOnMarginPercent, audit[] }`

`fraction < 1` produce un cierre parcial. Si hay niveles definidos, comprueba antes si se dispararon
y usa el precio del disparo, no el actual.

### `GET /api/simulations/:id/audit`

Traza completa: entrada y salida con proveedor, marca temporal y latencia; importes; niveles;
tiempos; declaración del estudiante; contexto congelado; traza de cálculo; y los asientos del libro
mayor asociados.

---

## Inteligencia artificial

### `POST /api/ai/analysis`

```jsonc
{
  "kind": "CHART_REVIEW",   // CHART_REVIEW | POST_TRADE | JOURNAL_REVIEW | NEWS_EXPLAINER | CONCEPT
  "symbol": "EURUSD",
  "timeframe": "1h",
  "indicators": ["SMA20", "RSI14", "ATR14"],
  "simulationId": "…",      // obligatorio para POST_TRADE
  "question": "¿qué me dice la separación entre las medias?"
}
```

→ `{ id, analysis, engine, promptVersionId, degraded, engineNotice, usage: { used, limit } }`

`analysis` cumple siempre este esquema, validado antes de mostrarse y de persistirse:

```
contextSummary          resumen neutro de lo observado
observedTrend           tendencia descrita, no predicha
bullishEvidence[]       mínimo 1 — el análisis nunca es unilateral
bearishEvidence[]       mínimo 1
relevantIndicators[]    { name, reading, interpretation } — reading debe existir en el contexto
risks[]                 mínimo 1
bullishScenario         condicional
bearishScenario         condicional
invalidationConditions[] mínimo 1, con niveles observables
questionsForStudent[]   entre 2 y 5
recommendedLesson       { slug, title, reason } o null
uncertaintyLevel        ALTA | MEDIA | BAJA
sourcesUsed[]
educationalDisclaimer
```

`degraded: true` indica que respondió el motor determinístico. `engineNotice` explica por qué, y la
interfaz lo muestra.

`429` cuando se agota la cuota del plan, con `{ used, limit, upgradeTo }`.

---

## Academia

### `POST /api/academy/progress`

`{ lessonSlug, status: "IN_PROGRESS" | "COMPLETED" }`

Marcar como completada exige haber superado el cuestionario (si lo hay) y haber creado al menos una
simulación (si la lección lo requiere). Devuelve `badgesAwarded[]`.

### `POST /api/academy/quiz`

`{ lessonSlug, answers: [0,2,1] }` → `{ score, passed, passingScore, correct, total, detail[], improvement }`

La corrección ocurre en el servidor. Las respuestas correctas nunca llegan al navegador antes de
responder.

---

## Diario, estadísticas y listas

- `POST /api/journal` — crea una entrada; si va asociada a una simulación, congela el gráfico.
- `GET /api/journal?tag=&emotion=&limit=` — entradas, etiquetas y errores repetidos.
- `GET /api/stats` — estadísticas educativas, curva de resultado acumulado y evolución en
  evaluaciones. El indicador de cabecera es `disciplineScore`.
- `GET|POST /api/watchlist` — lista de seguimiento; acciones `ADD`, `REMOVE`, `TOGGLE_FAVORITE`.
- `GET|POST|DELETE /api/alerts` — alertas de precio, con límite por plan.
- `POST /api/challenges/join` — participar en un reto.
- `POST /api/support` — ticket de soporte; la categoría `FRAUDE` entra con prioridad alta.
- `POST /api/demo/reset` — reinicia el saldo virtual dentro del límite mensual del plan. Exige no
  tener simulaciones abiertas y registra el asiento de corrección.

---

## Publicidad

### `GET /api/ads/serve?slot=dashboard-side&page=dashboard&topic=`

→ `{ ad: ServedAd | null, reason }`

`reason` puede ser `SERVED`, `PLAN_PREMIUM_NO_ADS`, `FORBIDDEN_SURFACE`, `UNKNOWN_SLOT`,
`NO_CANDIDATES`, `ALL_CAPPED` o `NO_MATCH`. La decisión se toma íntegramente en el servidor: el
navegador nunca recibe el inventario.

### `POST /api/ads/event`

`{ creativeId, campaignId, slotCode, type: "IMPRESSION" | "CLICK" | "VIEWABLE", page }`

El consumo de presupuesto se calcula aquí: una impresión CPM descuenta la milésima parte del CPM y
un clic CPC descuenta el CPC.

---

## Facturación

- `POST /api/billing/subscribe` — `{ planId, interval, couponCode?, idempotencyKey }`. La clave de
  idempotencia impide cobrar dos veces el mismo intento.
- `POST /api/billing/cancel` — `{ atPeriodEnd: true }`. Un solo paso, sin encuestas obligatorias.
- `POST /api/billing/webhook` — verifica la firma HMAC y procesa de forma idempotente por
  identificador de evento. Reprocesar el mismo evento no duplica pagos ni prolonga suscripciones.

---

## Límites de frecuencia

| Familia | Límite | Ventana |
|---|---|---|
| Inicio de sesión | 8 | 5 min (por IP y por correo) |
| Registro | 5 | 1 h |
| Análisis de IA | 20 | 5 min |
| Creación de simulaciones | 40 | 5 min |
| Datos de mercado | 240 | 1 min |
| Eventos publicitarios | 120 | 1 min |
| Soporte | 5 | 1 h |

Al superarse se devuelve `429` con `Retry-After` en segundos.
