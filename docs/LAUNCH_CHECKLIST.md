# Checklist de lanzamiento

## Criterios de aceptación del pliego

Estado verificado sobre el código y la aplicación en ejecución.

| # | Criterio | Estado | Dónde se garantiza |
|---|---|---|---|
| 1 | Todo usuario nuevo recibe exactamente USD 10.000 virtuales | ✅ | `INITIAL_DEMO_BALANCE_CENTS`, `ensureDemoAccount`, asiento de apertura |
| 2 | La palabra DEMO aparece junto al saldo | ✅ | `VirtualBalance` y `DemoBadge`, usados en panel, terminal, perfil y barra lateral |
| 3 | No existe función para depositar dinero | ✅ | No hay endpoint ni modelo de datos de depósito |
| 4 | No existe función para retirar ganancias virtuales | ✅ | No hay endpoint de retiro; documentado en el centro legal |
| 5 | Las simulaciones se calculan desde datos auditables | ✅ | Motor determinístico, contexto congelado, traza de cálculo, `/api/simulations/:id/audit` |
| 6 | La fuente y la latencia del precio son visibles | ✅ | `DataProvenanceBadge` junto a cada gráfico y cotización |
| 7 | El gráfico funciona en escritorio y móvil | ✅ | Canvas propio, responsive, con hoja inferior en móvil |
| 8 | La IA nunca promete resultados | ✅ | Guardarraíles con 5 familias de patrones + lista de expresiones prohibidas; 21 pruebas |
| 9 | La IA no inventa precios ni noticias | ✅ | El backend calcula los indicadores; verificación de fabricación de lecturas |
| 10 | Cada análisis incluye incertidumbre y riesgos | ✅ | Obligatorio en el esquema; se bloquea si falta |
| 11 | Los anuncios no interfieren con la simulación | ✅ | 8 superficies prohibidas verificadas en servidor y en componente |
| 12 | Premium no muestra publicidad | ✅ | Primera comprobación de `selectAd`; verificado end-to-end |
| 13 | Las atribuciones de terceros respetan sus licencias | ✅ | Gráfico propio sin atribución obligatoria; `ChartAttribution` para el futuro |
| 14 | Modo oscuro y claro completamente legibles | ✅ | Tres temas más alto contraste, con tokens completos |
| 15 | Las operaciones pueden revisarse en el diario | ✅ | Diario con simulaciones asociadas y sección de pendientes de documentar |
| 16 | El panel administrativo conserva auditoría | ✅ | `AuditLog` y `/admin/auditoria` |
| 17 | Los pagos son idempotentes | ✅ | Clave de idempotencia en checkout; `processWebhook` por identificador de evento |
| 18 | Los costes de IA pueden medirse | ✅ | Coste por llamada, agregado diario y mensual, tope configurable |
| 19 | Los usuarios pueden cancelar fácilmente | ✅ | Un paso desde el perfil, sin encuestas ni contacto con soporte |
| 20 | La experiencia es accesible | ⚠️ | WCAG AA implementado; falta auditoría con usuarios reales |
| 21 | El producto no usa afirmaciones engañosas | ✅ | 19 expresiones prohibidas aplicadas en producto, IA y publicidad |
| 22 | La plataforma puede cambiar de proveedor de datos | ✅ | Interfaz `MarketDataProvider` y registro; documentado |
| 23 | El sistema soporta español desde el inicio | ✅ | Todo el producto, el contenido y los mensajes de error en español |
| 24 | La arquitectura permite añadir inglés y portugués | ⚠️ | `Locale` modelado y persistido; faltan los catálogos de traducción |
| 25 | El resultado visual es original, premium y consistente | ✅ | Sistema de diseño propio; sin componentes ni marcas de terceros |

**23 de 25 completos. 2 parciales**, ambos documentados abajo con lo que falta exactamente.

---

## Antes de abrir el registro público

### Bloqueantes

- [x] **Programador de cobros.** Creado el 7 de septiembre de 2026 en
      `nexant-87204` / `us-east4`, a las 13:20 de Bogotá. Sin él ninguna prueba
      gratuita convertía. Ver `docs/BILLING-SCHEDULER.md`.
- [x] **`MARKET_DATA_PROVIDER=real`** en el entorno desplegado. Con `binance`,
      todo lo que no era cripto salía del motor determinístico y se publicaba un
      precio inventado. Comprobado en `/api/market/status`: `healthy: true` y las
      siete familias con `real: true`.

- [ ] **Revisión jurídica** de los siete documentos legales en cada jurisdicción de destino.
- [ ] **Información registral** de la entidad: razón social, domicilio, identificación fiscal.
- [ ] **PostgreSQL** en lugar de SQLite, con copias de seguridad automáticas y **restauración
      probada**.
- [ ] **`AUTH_SECRET`** de 48 bytes aleatorios, distinto por entorno.
- [ ] **HTTPS obligatorio** con HSTS.
- [ ] **Verificación de correo** activa. El modelo tiene `emailVerifiedAt`; falta el envío.
- [ ] **Pasarela de pagos real**: implementar `StripeBillingProvider` y configurar el webhook.
- [ ] **`npm audit`** sin vulnerabilidades altas o críticas.
- [ ] Comprobar que ningún secreto llega al cliente:
      `grep -r "OPENAI_API_KEY\|STRIPE_SECRET" .next/static/` debe devolver vacío.

### Importantes

- [ ] **Proveedor de datos con licencia** si se quieren precios de mercado reales. Sin él, el motor
      determinístico funciona y está marcado como educativo en toda la interfaz.
- [ ] **Redis** para la limitación de frecuencia si hay más de una instancia.
- [ ] **CSP con nonce** en lugar de `'unsafe-inline'`.
- [ ] **MFA** para los roles administrativos.
- [ ] **WAF** delante de la aplicación.
- [ ] **Sentry** u equivalente conectado.
- [ ] **Tareas programadas** de liquidación, limpieza y comprobación de proveedores.
- [ ] **Interfaz de gestión de roles** en el panel administrativo (hoy se hace en base de datos).
- [ ] **Semilla separada**: catálogo en producción, datos de demostración solo en staging.

### Deseables

- [ ] **Auditoría de accesibilidad** con usuarios reales y lectores de pantalla → criterio #20.
- [ ] **Catálogos de traducción** para inglés y portugués → criterio #24.
- [ ] Vídeos con subtítulos y transcripción.
- [ ] Certificados verificables con página pública de verificación.
- [ ] WebSocket en lugar del intervalo de 15 segundos de la terminal.
- [ ] Exportación a PDF de informes y certificados.

---

## Estado por área del pliego

| Área | Estado |
|---|---|
| Landing pública | Completa: hero interactivo, 4 pasos, mercados, IA, academia, filosofía, planes, FAQ, cierre |
| Registro e inicio de sesión | Completo, con tres consentimientos registrados y versionados |
| Onboarding educativo | Completo: 5 pasos, evaluación de 8 preguntas, clasificación en 4 niveles |
| Dashboard principal | Completo, con disciplina como indicador de cabecera |
| Terminal de simulación | Completa: 3 modos, gráfico propio, 12 indicadores, 8 temporalidades, 5 pestañas |
| Academia | 14 rutas, 21 lecciones con cuestionarios corregidos en servidor y simulaciones obligatorias |
| Asistente educativo con IA | Completo, con guardarraíles, respaldo determinístico y control de coste |
| Diario de trading | Completo, con detección de patrones por emoción y errores repetidos |
| Estadísticas | Completas, con disciplina, desgloses y evolución educativa |
| Retos y gamificación | 12 insignias y 7 retos, ninguno basado en beneficio virtual |
| Calendario económico | Determinístico, con nota educativa por evento |
| Noticias educativas | 6 artículos propios; sin noticias de actualidad hasta tener licencia |
| Planes y suscripciones | Completos, con matriz de derechos aplicada en servidor |
| Sistema publicitario | Completo: inventario, campañas, revisión, capping, viewability, exclusiones |
| Perfil y configuración | Completo, con accesibilidad, privacidad, sesiones y exportación |
| Centro de ayuda | Completo, con formulario y prioridad para avisos de fraude |
| Panel administrativo | 12 secciones con permisos por rol |
| CMS educativo | Lectura y métricas completas; edición desde base de datos |
| Panel de analítica | 32 métricas agrupadas por categoría |
| Centro legal | 7 documentos versionados con registro de consentimientos |

---

## Verificación ejecutada

```
npm run typecheck   ✅  sin errores, TypeScript estricto
npm test            ✅  99 pruebas en 4 suites
npm run build       ✅  47 rutas compiladas
```

Comprobado en ejecución, extremo a extremo:

- Rutas públicas responden 200; las protegidas redirigen a `/entrar`.
- Inicio de sesión, panel y las diez secciones del producto cargan con sesión.
- Simulación creada, cerrada y auditada: motor `1.0.0`, 3 asientos, 5 líneas de traza.
- Análisis de IA con motor determinístico: incertidumbre ALTA, 4 riesgos, 3 condiciones de
  invalidación.
- Estadísticas: puntuación de disciplina calculada, muestra clasificada como orientativa.
- Publicidad: `SERVED` en superficie válida, `FORBIDDEN_SURFACE` en el formulario de operación,
  `PLAN_PREMIUM_NO_ADS` para Premium.
- RBAC: un estudiante que solicita `/admin` es redirigido.
- Plan: modo POSITION bloqueado con 403 para un usuario Free.
- Validación: niveles incoherentes de stop loss y take profit rechazados.
- Las 12 secciones administrativas cargan para el rol de administración general.
