# TradingLab

**Plataforma educativa de análisis y simulación de mercados financieros.**

Aprende a analizar los mercados sin arriesgar tu dinero: USD 10.000 virtuales, academia
estructurada, terminal de simulación y un entrenador educativo con inteligencia artificial que
explica, pregunta y señala riesgos —pero nunca dice qué comprar.

---

## Qué es y qué no es

TradingLab **no es un broker regulado**. No recibe dinero para inversión, no admite depósitos de
capital de trading, no permite retirar utilidades, no custodia fondos ni activos, no ejecuta órdenes
en mercados reales y no promete rentabilidad. Todas las operaciones usan dinero virtual y los
precios se muestran exclusivamente con fines educativos.

Estas afirmaciones no son solo texto legal: están implementadas. No existe ningún endpoint de
depósito ni de retiro, el saldo virtual vive en un libro mayor auditable y la palabra DEMO acompaña
al saldo en toda la interfaz.

---

## Arranque rápido

Requisitos: Node.js 20 o superior. No hace falta base de datos ni ninguna credencial externa.

```bash
npm install
cp .env.example .env       # genera un AUTH_SECRET propio (ver más abajo)
npm run setup              # prisma generate + db push + semilla de datos
npm run dev                # http://localhost:3000
```

Genera un secreto de sesión antes del primer arranque:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

y pégalo en `AUTH_SECRET` dentro de `.env`.

### Cuentas de demostración

Contraseña común: `Demo1234!`

| Correo | Plan | Rol | Para qué sirve |
|---|---|---|---|
| `estudiante@tradinglab.example` | Free | Estudiante | Ver los límites del plan gratuito |
| `intermedio@tradinglab.example` | Standard | Estudiante | Historial amplio, estadísticas y diario poblados |
| `admin@tradinglab.example` | Premium | Super Admin | Panel administrativo completo, sin publicidad |

### Comandos

```bash
npm run dev         # desarrollo
npm run build       # build de producción
npm start           # servidor de producción
npm run typecheck   # TypeScript en modo estricto
npm test            # 99 pruebas del motor, la IA, los datos y la publicidad
npm run db:reset    # recrea la base de datos y vuelve a sembrarla
npm run db:studio   # inspector visual de la base de datos
```

---

## Qué funciona hoy

Todo lo siguiente está implementado y verificado de extremo a extremo:

**Público** · Landing de conversión con maqueta interactiva del terminal · Precios con tabla
comparativa completa · Mercados · Recursos y glosario · Centro legal versionado · Estado del
servicio en tiempo real · Anunciantes · Contacto

**Producto** · Registro con consentimientos registrados y cuenta DEMO automática · Onboarding con
evaluación de 8 preguntas y clasificación por nivel · Panel con puntuación de disciplina · Terminal
de simulación con gráfico propio · Tres modos de simulación · Academia con 14 rutas y cuestionarios
corregidos en servidor · Diario educativo con detección de patrones · Estadísticas · Entrenador con
IA · Retos e insignias · Calendario económico · Artículos · Perfil con cancelación en dos clics

**Administración** · 12 secciones con permisos por rol · Auditoría de simulaciones con verificación
de integridad del libro mayor · Control de coste de IA · Gestión de proveedores de datos ·
Inventario y campañas publicitarias · Analítica del negocio · Cumplimiento · Soporte · Registro de
auditoría

---

## Decisiones de diseño que conviene conocer

**El motor de simulación es determinístico y auditable.** No usa `Math.random()` ni el reloj del
sistema: recibe todos los instantes como parámetro. El precio de un instrumento en un momento dado
siempre es el mismo, así que cualquier resultado puede recalcularse y verificarse meses después.
Cada simulación guarda el proveedor, la marca temporal, la latencia, los indicadores congelados, la
versión del motor y la traza completa del cálculo.

**El saldo virtual nunca se modifica directamente.** Todo cambio es un asiento en un libro mayor con
motivo, referencia y saldo resultante. El panel administrativo verifica que el saldo almacenado
coincide con la suma de los asientos.

**La IA no puede inventar datos.** El backend calcula los indicadores y se los entrega ya
resueltos. El modelo produce una salida estructurada obligatoria que incluye riesgos, condiciones de
invalidación y nivel de incertidumbre. Un sistema de guardarraíles analiza cada respuesta antes de
mostrarla: bloquea órdenes imperativas, afirmaciones de certeza, promesas de rentabilidad e
inducciones a endeudarse, y marca lecturas de indicador que no coincidan con el contexto entregado.
Si no supera los controles —o si no hay credencial configurada— se sirve un análisis determinístico
local, indicando siempre qué motor lo generó.

**El gráfico es propio.** Implementación original sobre `<canvas>`, sin bibliotecas de terceros:
velas, línea, área, Heikin-Ashi, volumen, indicadores superpuestos y en panel, marcadores de
operaciones, eventos económicos, zoom y desplazamiento. Ninguna atribución obligatoria se oculta
nunca; si en el futuro se adopta una biblioteca con licencia, su atribución se renderiza en
`ChartAttribution` y queda siempre visible.

**El éxito no se mide por rentabilidad virtual.** El indicador de cabecera del estudiante es una
puntuación de disciplina que combina uso de stop loss, relación riesgo-beneficio, contención del
riesgo, registro en el diario, ausencia de impulsividad y calidad del razonamiento escrito. Ganar
mucho sin stop loss ni plan **baja** esa puntuación, y hay una prueba automatizada que lo garantiza.

**La publicidad tiene límites duros.** Premium no genera ni una sola solicitud de anuncio. Existe
una lista de superficies prohibidas verificada en el servidor y en el componente de renderizado: el
gráfico, el formulario de operación, la confirmación de una simulación, las alertas de riesgo, los
cuestionarios, los análisis de IA y el checkout. Todo espacio comercial se etiqueta y la etiqueta no
se puede desactivar.

---

## Estructura

```
src/
  packages/               # Módulos independientes, sin dependencias circulares
    types/                # Contratos de dominio, matriz de planes, textos de cumplimiento
    market-data/          # Abstracción de proveedores, motor determinístico, indicadores
    simulation-engine/    # Motor puro: apertura, cierre, disparos, libro mayor, estadísticas
    ai/                   # Esquema, prompts versionados, guardarraíles, cliente y respaldo
    ads/                  # Servidor publicitario, revisión de creatividades, paquetes
    analytics/            # Catálogo de eventos y definición de métricas
    ui/                   # Sistema de diseño, gráfico, componentes de cumplimiento
  lib/                    # Servicios de servidor: auth, RBAC, límites, facturación, servicios
  content/                # Academia, glosario, gamificación, evaluación, textos legales
  app/                    # Rutas de Next.js (App Router)
prisma/                   # Esquema de datos y semilla
tests/                    # Pruebas del motor, la IA, los datos y la publicidad
docs/                     # Arquitectura, API, seguridad, despliegue, cumplimiento, checklist
```

Documentación detallada en [`docs/`](./docs):
[Arquitectura](./docs/ARCHITECTURE.md) ·
[Contratos de API](./docs/API.md) ·
[Sistema de diseño](./docs/DESIGN_SYSTEM.md) ·
[Datos de mercado](./docs/MARKET_DATA.md) ·
[Seguridad](./docs/SECURITY.md) ·
[Despliegue](./docs/DEPLOYMENT.md) ·
[Firebase](./docs/FIREBASE.md) ·
[Administración](./docs/ADMIN.md) ·
[Cumplimiento](./docs/COMPLIANCE.md) ·
[Checklist de lanzamiento](./docs/LAUNCH_CHECKLIST.md) ·
[Hoja de ruta](./docs/ROADMAP.md)

---

## Despliegue en Firebase

El repositorio está configurado para **Firebase App Hosting**, que construye desde GitHub y ejecuta
Next.js con renderizado en servidor sobre Cloud Run.

**Firebase Hosting a secas no sirve para esta aplicación.** Hosting entrega archivos estáticos, y
aquí dependen del servidor las sesiones, las 24 rutas de API, Prisma, el motor de simulación y los
guardarraíles de IA —que además no deben ejecutarse en el navegador, donde el usuario podría
manipularlos. Un export estático dejaría la landing y poco más.

Lo que hay que hacer, resumido:

1. Proyecto de Firebase en plan Blaze.
2. Una base PostgreSQL (Neon, Supabase o Cloud SQL) con cadena de conexión **con pooling**. SQLite no
   vale en Cloud Run: el sistema de archivos es efímero y no se comparte entre instancias.
3. Dos secretos: `firebase apphosting:secrets:set DATABASE_URL` y `AUTH_SECRET`.
4. `firebase apphosting:backends:create` y conectar este repositorio.

A partir de ahí, cada `git push` a `main` despliega. El paso a paso completo, con los problemas
frecuentes y sus causas, está en [`docs/FIREBASE.md`](./docs/FIREBASE.md).

El cambio de SQLite a PostgreSQL no exige tocar el esquema a mano: `scripts/set-db-provider.mjs`
reescribe la línea del proveedor a partir de `DATABASE_PROVIDER`, de modo que hay una sola fuente de
verdad en lugar de dos esquemas que se desincronizan.

---

## Lo que falta antes de operar comercialmente

Está documentado sin rodeos en el [checklist de lanzamiento](./docs/LAUNCH_CHECKLIST.md). Lo
esencial:

1. **Revisión jurídica** de los siete documentos del centro legal en cada jurisdicción de destino, y
   alta de la información registral de la entidad.
2. **Proveedor de datos con licencia** si se quiere mostrar precios de mercado reales. El motor
   determinístico incluido está marcado como educativo en toda la interfaz.
3. **Pasarela de pagos real**. La capa de facturación está aislada tras una interfaz y funciona en
   modo de demostración; conectar Stripe es implementar `BillingProvider`.
4. **PostgreSQL** en lugar de SQLite, y Redis para la limitación de frecuencia si hay varias
   instancias.
5. **Verificación de correo y MFA**: el modelo de datos ya los contempla; falta el envío real.
6. **Auditoría de accesibilidad** con usuarios reales y lectores de pantalla.

---

## Licencia y marcas

El código original de TradingLab se distribuye bajo la [licencia MIT](./LICENSE).
Los componentes y recursos de terceros conservan sus respectivas licencias. Esta licencia no
concede derechos sobre marcas comerciales ni sobre datos de proveedores externos.

Todo el código, el diseño y el contenido educativo de este repositorio son originales. No se han
copiado marcas, componentes, textos, diseños, nombres, iconos ni interfaces de IQ Option,
TradingView ni de ninguna otra plataforma. Las menciones a terceros aparecen únicamente en contextos
comparativos o informativos.
