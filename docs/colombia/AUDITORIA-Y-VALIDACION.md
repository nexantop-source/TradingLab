# Auditoría de mercado y validación de cambios

Fecha: 20 de septiembre de 2026. Cambios de código locales; sin despliegue, cuentas creadas, órdenes ni pagos reales.

## Cotizaciones de producción

Se consultaron los 334 identificadores del catálogo local mediante el endpoint público de producción `/api/market/quotes`, en grupos de hasta 30. Consulta entre 21:24:17 y 21:24:22 UTC (16:24 de Colombia). Todos los lotes respondieron. El catálogo incluye alias, por lo que el número no equivale a subyacentes únicos.

Evidencia: [market-audit.json](./market-audit.json). Script reproducible: [audit-market-catalog.ts](../../scripts/audit-market-catalog.ts). Ejecutar desde la raíz con `node --import tsx scripts/audit-market-catalog.ts`; requiere acceso a la red y sobrescribe la instantánea. `MARKET_AUDIT_BASE` permite indicar otro despliegue. Un fallo de transporte se registra como auditoría inconclusa, separado de un instrumento omitido en una respuesta válida.

| Clase | Muestra reciente marcada REALTIME | Referencia con mercado declarado cerrado | Diferida/antigua | Sin cotización | Total |
|---|---:|---:|---:|---:|---:|
| Cripto | 60 | 0 | 8 | 0 | 68 |
| Acciones | 0 | 108 | 0 | 0 | 108 |
| ETF | 0 | 65 | 0 | 0 | 65 |
| Divisas | 0 | 50 | 0 | 0 | 50 |
| Índices | 0 | 22 | 0 | 1 | 23 |
| Materias primas | 0 | 20 | 0 | 0 | 20 |
| **Total** | **60** | **265** | **8** | **1** | **334** |

Fuentes observadas: 66 cotizaciones Binance y 267 Yahoo; un identificador no obtuvo cotización. No hubo series sintéticas en las respuestas recibidas. La referencia diaria de divisas existe como respaldo en el código, pero no fue la fuente usada en esta muestra.

El criterio “muestra reciente” exige `synthetic=false`, `freshness=REALTIME` y antigüedad de hasta 30 segundos. Es un criterio de auditoría, no un SLA. El estado cerrado procede de la aplicación y su lógica de horarios; no se comprobó contra el calendario oficial de cada bolsa.

### Excepciones

| Identificador | Hallazgo en la muestra | Interpretación |
|---|---|---|
| 1INCHUSD | Binance, STALE, 12 s | La política del proveedor lo marcó antiguo; no cambiar la etiqueta para aparentar mejor cobertura. |
| ATOMUSD | Binance, STALE, 14 s | Requiere observación continuada si se ofrece práctica sensible al segundo. |
| COMPUSD | Binance, STALE, 11 s | Mismo criterio. |
| IMXUSD | Binance, STALE, 14 s | Mismo criterio. |
| KAVAUSD | Binance, STALE, 13 s | Mismo criterio. |
| MKRUSD | Yahoo, REALTIME declarado, 83 s | Supera el umbral de 30 s de esta auditoría; no se considera reciente. |
| SANDUSD | Binance, STALE, 14 s | No equivale a una caída permanente. |
| VETUSD | Binance, STALE, 10 s | La antigüedad mostrada está redondeada. |
| CHL30 | Omitido en respuesta válida | No hay cotización comprobada; no se sustituyó el índice por otro activo ni por una serie inventada. |

**Conclusión:** no se puede afirmar “todos los activos están en tiempo real”. El domingo limita la comprobación intradía de las bolsas cerradas. Para certificar más cobertura hay que repetir en sus sesiones abiertas, tomar múltiples muestras, revisar las velas además de las cotizaciones y confirmar las licencias comerciales. No se programó una automatización ni se contrató un proveedor.

## Correcciones de datos aplicadas localmente

1. Yahoo ya no usa la hora de recepción para inventar la hora de una cotización sin timestamp. Usa una vela fechada con su propio precio o rechaza la muestra.
2. Los datos por lotes conservan la correspondencia precio/hora cuando hay cierres nulos. Antes, un cierre anterior podía quedar unido al timestamp de un punto posterior sin precio.
3. El explorador transporta la frescura declarada y distingue muestra reciente, dato diferido, dato desactualizado y mercado cerrado. Envejece las etiquetas mientras permanece abierta la pantalla.
4. El explorador aclara que muestra una instantánea al cargar y permite actualizarla manualmente. No se añadió un streaming a todo el catálogo.
5. La sonda `/api/market/status` declara que solo prueba representantes; separa disponibilidad real de frescura. Una familia no queda certificada por una única cotización.
6. La landing tolera fallos parciales de sus tres muestras; si no hay ninguna, conserva el acceso al aprendizaje con una explicación.

La instantánea JSON corresponde a producción **antes** de publicar estas correcciones. No constituye una validación del código nuevo en producción.

## UX/UI y planes

Se rediseñaron login y registro, con identidad visible, explicación educativa, Colombia por defecto y un registro en dos pasos. Se preservan mayoría de edad, términos, privacidad y riesgo; el consentimiento de marketing continúa opcional y sin preseleccionar. La zona horaria sigue detectándose aunque ya no distrae en el formulario.

Se mantienen los endpoints y la navegación posterior a la sesión. Se añaden validación local con esquemas compartidos, foco en errores y bloqueo de envíos duplicados mientras se espera respuesta. El enlace entre login/registro conserva plan y periodicidad.

Los precios locales pasan a Plus USD 5,99/59,99 y Pro USD 19,99/199,99 (mes/año), con límites de IA mensuales 3/60/300 y simulaciones diarias 2/20/sin límite fijo. Los controles del servidor y las sugerencias del siguiente plan se ajustaron. Wompi permanece como pasarela; no se modificaron credenciales ni el despliegue. Las nuevas funciones de Pro propuestas en el plan comercial siguen pendientes.

## Verificación

- Suite local: **524 pruebas aprobadas en 47 archivos**. Incluye contrato Wompi con USD 5,99 y conversión determinista COP, límites mensuales del gratuito, sugerencias Plus→Pro y timestamps de Yahoo.
- TypeScript: `npm run typecheck` aprobado.
- Navegador local: inspección de escritorio 1440×1000, móvil 390×844 y móvil estrecho 320×740. Se revisaron jerarquía, campos, enlaces y ausencia de desbordamiento visible.
- Registro: errores con campos vacíos, paso a consentimientos con datos ficticios, rechazo sin consentimientos y regreso al primer paso; pudo volver a avanzar sin rellenar de nuevo los campos.
- Selección de Plus mensual preservada entre registro y login; Colombia aparece seleccionada y editable.
- No se completó un registro ni se realizó un pago real durante la prueba visual.
- Compilación de producción: `npm run build` aprobada. Se revisaron los precios mensuales y anuales y la página de mercados en el servidor local de producción. El pase visual detectó que una regla móvil antigua ocultaba el estado de frescura; se corrigió para conservarlo también en pantallas pequeñas.

## Pendientes antes de escalar

Revisión en sesiones de mercado abiertas, resolver cobertura de CHL30 con una fuente válida, derechos comerciales de datos, medir costos reales de IA, recuperación segura de acceso, probar el primer ciclo educativo con usuarios y validar compra/expiración en Wompi sandbox. El informe no afirma que se hayan auditado todos los flujos autenticados o que exista demanda pagadora.

## Actualización: Yahoo como fuente principal

Por solicitud del usuario, la configuración de App Hosting y el valor predeterminado usan Yahoo Finance para cotizaciones e históricos. Wompi y los nuevos planes permanecen vigentes. La auditoría anterior de producción describe el estado previo al cambio, no el nuevo proveedor.

La consulta directa del adaptador Yahoo (2026-09-20T22:06:44.961Z) devolvió 328 cotizaciones reales de 334 identificadores. Sin cotización: SOLUSDT, ETHUSDT, BTCUSDT, APTUSD, UNIUSD, CHL30. Los pares USDT no se sustituyen por USD. Evidencia: [yahoo-audit.json](./yahoo-audit.json); reproducción: `node --import tsx scripts/audit-yahoo.ts`. Los cinco históricos de muestra (BTCUSD, AAPL, EURUSD, SPX500 y XAUUSD) devolvieron 100 velas cada uno. Una muestra no acredita disponibilidad continua ni licencia de redistribución.

El servidor impide abrir y cerrar manualmente ejercicios con mercado cerrado o sin cotización válida. Los vencimientos automáticos conservan la liquidación educativa contra observaciones históricas. El proveedor desconocido falla sin generar precios; el proveedor sintético solo puede seleccionarse en pruebas. El pulso Yahoo conserva el instante real, sin rellenar segundos pasados con el precio actual. El histórico consulta novedades cada 30 segundos mientras la pestaña está visible, respetando la caché del proveedor; esto no equivale a recibir una nueva cotización cada 30 segundos. Se muestra la fecha de la última vela. Yahoo puede tener retrasos según mercado y activo.

El saldo, los ejercicios y los costes educativos siguen siendo virtuales. Los precios y las velas proceden del mercado; no representan ejecución en una bolsa ni un libro de órdenes. La instantánea Yahoo no ofrece bid/ask: ambos campos técnicos usan la referencia recibida, sin inventar un diferencial de mercado.

Validación final: 530 pruebas en 48 archivos aprobadas; compilación de producción aprobada. La comprobación visual de acceso y registro cubrió escritorio y móvil. Publicación solicitada directamente en main; el estado del despliegue de App Hosting debe confirmarse por separado.
