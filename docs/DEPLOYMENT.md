# Guía de despliegue

> ## ⚠️ Antes de cada despliegue con cambios de esquema
>
> `npm run build` ejecuta `db:provider`, `prisma generate` y `next build`, pero
> **no aplica el esquema a la base desplegada**. Eso se hace aparte:
>
> ```
> node scripts/db-remote.mjs push
> ```
>
> Si se olvida, el cliente de Prisma pide columnas que la base todavía no tiene
> y **falla toda petición autenticada**, porque `getAuth()` carga el perfil y la
> suscripción enteros en cada una. El síntoma es que el inicio de sesión parece
> funcionar —solo toca `User` y `Session`— y a continuación la aplicación no
> abre, igual en la PWA que en la web.
>
> Desde entonces la API responde `DATABASE_SCHEMA_OUTDATED` con un 503 en lugar
> de un 500 opaco, y `getAuth()` registra el comando exacto en el log del
> servidor. Si ves cualquiera de los dos, esto es lo que falta.
>
> Revisa `git log --stat -- prisma/schema.prisma` para saber si el despliegue
> que vas a hacer incluye cambios de esquema.

## Entornos

| Entorno | Base de datos | Datos de mercado | IA | Pagos | Publicidad |
|---|---|---|---|---|---|
| Local | SQLite | Motor determinístico | Determinístico local | Simulada | Servidor interno |
| Staging | PostgreSQL | Proveedor real, plan básico | OpenAI con tope bajo | Wompi Sandbox | Servidor interno |
| Producción | PostgreSQL + réplica | Proveedor real con licencia | OpenAI con tope | Wompi Producción | Interno o AdSense manual |

## 1. Migrar a PostgreSQL

En `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

El esquema ya es portable: los campos enumerados son `String` con valores tipados en
`packages/types`, y los JSON son `String` serializado. No hay nada específico de SQLite.

```bash
DATABASE_URL="postgresql://usuario:clave@host:5432/tradinglab?schema=public"
npx prisma migrate deploy
npm run db:seed        # solo en staging; en producción, siembra únicamente el catálogo
```

Para producción conviene separar la semilla en dos: catálogo (planes, instrumentos, academia,
glosario, documentos legales, inventario publicitario) y datos de demostración (usuarios e
historial). Solo la primera parte debe ejecutarse.

Recomendaciones: réplica de lectura para el panel de analítica, copias de seguridad automáticas
diarias con retención de 30 días, y **prueba periódica de restauración** —una copia que no se ha
restaurado nunca no es una copia.

## 2. Variables de entorno

Partiendo de `.env.example`. Las imprescindibles:

```bash
DATABASE_URL=            # PostgreSQL
AUTH_SECRET=             # 48 bytes aleatorios, distinto por entorno
NEXT_PUBLIC_APP_URL=     # https://tu-dominio
NODE_ENV=production
```

Genera el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Opcionales, cada una activa una capacidad:

```bash
OPENAI_API_KEY=              # sin ella, análisis determinísticos (funcional, indicado en la UI)
OPENAI_MODEL=gpt-4.1-mini
AI_MONTHLY_COST_CAP_USD=500  # al alcanzarlo, degrada al motor local en lugar de fallar

MARKET_DATA_PROVIDER=synthetic   # synthetic | twelvedata | finnhub
TWELVEDATA_API_KEY=
MARKET_DATA_DELAY_SECONDS=0      # latencia declarada del plan contratado

BILLING_PROVIDER=disabled        # disabled | wompi; mock únicamente en desarrollo local
WOMPI_ENVIRONMENT=sandbox        # sandbox | production
WOMPI_PUBLIC_KEY=
WOMPI_PRIVATE_KEY=               # solo para API/tokenización futura
WOMPI_INTEGRITY_SECRET=
WOMPI_EVENTS_SECRET=
WOMPI_PRICING_MODE=usd_trm        # usd_trm | fixed_cop (compatibilidad/pruebas)
# Los cuatro importes siguientes SOLO se usan con fixed_cop:
WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS=
WOMPI_STANDARD_YEARLY_AMOUNT_IN_CENTS=
WOMPI_PREMIUM_MONTHLY_AMOUNT_IN_CENTS=
WOMPI_PREMIUM_YEARLY_AMOUNT_IN_CENTS=

RESTRICTED_COUNTRIES=            # ISO-3166 alfa-2 separados por coma
SENTRY_DSN=
```

## 3. Conectar un proveedor de datos real

Ver [`MARKET_DATA.md`](./MARKET_DATA.md). Resumen: implementar `MarketDataProvider`, registrarlo en
`registry.ts` y cambiar `MARKET_DATA_PROVIDER`. Ninguna otra parte del código cambia.

Al contratar, comprueba: latencia del plan, límite de peticiones, si permite uso comercial, si exige
atribución visible y si cubre las clases de activo del catálogo. La latencia contratada debe
reflejarse en `MARKET_DATA_DELAY_SECONDS` para que la interfaz la declare con honestidad.

## 4. Conectar Wompi

La implementación usa el **Checkout Web oficial**. TradingLab genera en servidor una referencia
opaca única, congela el importe de la cotización, define una expiración
de 30 minutos, firma `<referencia><importe>COP<expiración><secreto-de-integridad>` y redirige a
`https://checkout.wompi.co/p/`.
Wompi solo admite COP en este flujo. Con `WOMPI_PRICING_MODE=usd_trm`, el servidor convierte
el precio USD de `PLAN_ENTITLEMENTS` usando la TRM vigente publicada por la Superintendencia
Financiera en [Datos Abiertos Colombia](https://www.datos.gov.co/Econom-a-y-Finanzas/Tasa-de-Cambio-Representativa-del-Mercado-TRM/32sa-8pi3).
No se acepta un precio ni una tasa enviados por el navegador. Referencias oficiales: [Checkout Web](https://docs.wompi.co/docs/colombia/widget-checkout-web/),
[eventos](https://docs.wompi.co/docs/colombia/eventos/) y
[transacciones](https://docs.wompi.co/docs/colombia/transacciones/).

1. En el Dashboard de comercios configura las tres credenciales necesarias del ambiente correspondiente: llave pública, secreto de integridad y secreto de eventos. Los
   secretos de integridad y eventos son diferentes de las llaves pública y privada.
2. Prepara `WOMPI_ENVIRONMENT` y `WOMPI_PRICING_MODE=usd_trm`. El catálogo mantiene Plus
   USD 14,99/mes o 149/año y Pro USD 29,99/mes o 299/año. Conserva `BILLING_PROVIDER=disabled`
   hasta completar la configuración y las pruebas. El modo alternativo `fixed_cop` exige cuatro
   importes fijos en centavos: COP 59.900 se configura como `5990000`.
3. `NEXT_PUBLIC_APP_URL` debe ser el origen HTTPS público. Wompi vuelve a
   `/perfil?checkout=wompi&id=<ID>`. La UI puede consultar de forma autenticada y de solo lectura
   `/api/billing/status?id=<ID>`; esta consulta **nunca activa** una membresía.
4. Configura la URL de eventos HTTPS como `https://tu-dominio/api/billing/webhook`. Usa una URL y
   credenciales distintas para Sandbox y Producción. El evento procesado es `transaction.updated`.
5. Ejecuta una compra aprobada, una rechazada, una anulada y reenvía el mismo evento para comprobar
   que no se duplica ni prolonga el periodo.

En Firebase App Hosting, mantén `BILLING_PROVIDER=disabled` hasta que existan los tres secretos
usados por Checkout Web y eventos. `mock` está bloqueado por código cuando `NODE_ENV=production`:
una configuración incompleta no puede regalar planes. Crea los secretos y concede acceso al backend:

El checkout también exige el secreto de eventos y una URL de retorno HTTPS antes de escribir
un intento de pago. Su respuesta autenticada y `private, no-store` incluye `paymentId`,
`reference`, `expiresAt`, `environment` y el enlace firmado. La pantalla permite copiar ese
enlace y muestra el ID; no se aplica un código manual a otra cuenta. El pago permanece unido
al `userId` registrado por el servidor. Este flujo vende un periodo, sin débitos recurrentes.

```bash
firebase apphosting:secrets:set TRADINGLAB_WOMPI_PUBLIC_KEY --project nexant-87204
firebase apphosting:secrets:set TRADINGLAB_WOMPI_INTEGRITY_SECRET --project nexant-87204
firebase apphosting:secrets:set TRADINGLAB_WOMPI_EVENTS_SECRET --project nexant-87204
firebase apphosting:secrets:grantaccess TRADINGLAB_WOMPI_PUBLIC_KEY,TRADINGLAB_WOMPI_INTEGRITY_SECRET,TRADINGLAB_WOMPI_EVENTS_SECRET \
  --backend tradinglab --project nexant-87204
```

Para cargar los valores desde `.env.wompi.local` (ignorado por Git), sin incluirlos en
argumentos de terminal ni imprimirlos, usa Node 24 y la sesión Firebase de
`nexantop@gmail.com`:

```bash
node scripts/upload-wompi-secrets.mjs          # solo valida el archivo local
node scripts/upload-wompi-secrets.mjs --apply  # carga nuevas versiones y concede acceso
```

El script exige producción con `BILLING_PROVIDER=disabled`, no guarda la llave privada
y no cambia el webhook ni activa pagos. Cada ejecución con `--apply` crea nuevas
versiones: no lo ejecutes para consultar el estado. Los nombres `TRADINGLAB_*` evitan
modificar secretos de Nexant u otros backends. Esto no sustituye la regeneración de
secretos en Wompi: si se compartieron en un chat o comentario, deben rotarse allí,
coordinar otras aplicaciones afectadas, actualizar el archivo local, subir las nuevas
versiones y desplegar de nuevo antes de habilitar cobros.

`apphosting.yaml` referencia esos nombres como secretos `RUNTIME`, con ambiente de producción
y `usd_trm`, pero mantiene facturación desactivada. Antes de cambiar `BILLING_PROVIDER` a `wompi`,
prueba la integración en un entorno Sandbox separado con sus propias credenciales y webhook.
`WOMPI_PRIVATE_KEY` no se necesita para Checkout Web ni para consultar una
transacción y no debe añadirse hasta implementar tokenización/cargos API con un alcance aprobado.

El webhook limita el tamaño, exige JSON, valida el ambiente y calcula SHA-256 usando la lista
**dinámica** `signature.properties`, el `timestamp` y `WOMPI_EVENTS_SECRET`. Si llega
`X-Event-Checksum`, también debe coincidir en tiempo constante con el checksum del cuerpo. Después
de validar la firma, el servidor consulta `GET /v1/transactions/{id}` directamente a Wompi y exige
que identificador, referencia, COP e importe coincidan con el `Payment` creado por TradingLab. Solo
esa respuesta autoritativa puede activar o anular acceso.

Estados: `APPROVED` activa una vez y calcula el periodo en servidor; `DECLINED`/`ERROR` fallan el
intento sin tocar otro periodo vigente; `PENDING` no degrada estados finales; `VOIDED` cancela solo
la membresía cuyo `externalId` corresponde exactamente a esa compra. Los payloads almacenados para
auditoría se reducen a campos operativos y no conservan email ni datos del método de pago.

Solo puede existir un checkout pendiente por cuenta. La URL y su firma expiran juntas a los 30
minutos. Un intento expirado que nunca produjo un `transaction.id` se marca `SUPERSEDED`; si Wompi
reportara una aprobación tardía o coexistiera otro periodo activo, el pago pasa a
`REVIEW_REQUIRED`, genera una alerta de soporte y **no** reemplaza ni extiende la membresía. El
importe se valida contra el snapshot inmutable guardado en `Payment`, por lo que cambiar precios no
invalida compras ya abiertas.

### Conversión USD a COP

La TRM es una tasa oficial diaria, no una cotización de mercado minuto a minuto. Se consulta
`GET https://www.datos.gov.co/resource/32sa-8pi3.json` filtrando la fecha actual en Colombia
(UTC−5) dentro del intervalo inclusivo `vigenciadesde`–`vigenciahasta`. La vigencia puede abarcar
fines de semana y festivos. Una tasa futura, vencida, ambigua o inválida bloquea un nuevo intento;
no se utiliza una tasa inventada ni la última conocida fuera de vigencia. La caché en memoria dura
como máximo una hora y nunca ignora la fecha de vigencia; la consulta tiene timeout y límite de tamaño.

Se calcula `round(centavos_USD × TRM_en_centésimas / 100)` en centavos COP, sin recargo de
conversión. El checkout muestra USD base, COP final con dos decimales, TRM, fuente y fechas antes
de abrir Wompi. Los bancos pueden aplicar cargos propios. La cotización queda persistida en un
tag versionado `[tl:fx:v1:…]` en `Payment.description`, junto a los metadatos existentes de plan;
no contiene información personal. Así no se requiere una migración destructiva ni se pierde la
auditoría. Los reintentos reutilizan importe, tasa y expiración originales sin consultar de nuevo
la TRM. El webhook sigue comparando el importe COP persistido, nunca la tasa del día del evento.

Wompi puede generar un segundo ID de transacción con la **misma referencia** cuando el pagador usa
su reintento oficial tras un rechazo. La reconciliación admite que ese segundo ID aprobado sustituya
al fallido únicamente si referencia, COP e importe servidor coinciden. Un segundo `APPROVED` no
extiende de nuevo y un `VOIDED` cuyo ID no sea el de la membresía activa no la cancela. Consulta
[Reintento de pagos](https://docs.wompi.co/docs/colombia/reintento-de-pago/).

### Alcance de renovación

Este Checkout cobra **un periodo por compra**. Cancelar evita mantener el acceso más allá del
periodo, pero no existe todavía un cargo automático futuro. Para renovación automática real hay que
implementar Fuentes de Pago/Tokenización con aceptación explícita de los contratos de Wompi,
guardar únicamente el `payment_source_id` (nunca PAN/CVC), añadir un job de cobro y confirmar con
Wompi la habilitación 3DS/3RI aplicable. Consulta
[Fuentes de Pago](https://docs.wompi.co/docs/colombia/fuentes-de-pago/). No actives ese flujo usando
solo la llave privada.

**No elimines la idempotencia ni la reconciliación server-to-server.** Wompi reintenta eventos y el
navegador de retorno no es una fuente confiable para conceder acceso.

## 5. Construir y desplegar

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm start
```

### Vercel

Funciona sin configuración adicional. Ajustes:

- Comando de build: `prisma generate && prisma migrate deploy && next build`
- Base de datos con connection pooling (PgBouncer o Neon). Prisma en serverless abre una conexión
  por invocación: sin pooling se agotan las conexiones.
- Las variables de entorno se configuran por entorno en el panel de Vercel.

### Contenedor

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

Con CDN delante para los activos estáticos y WAF delante de todo.

## 6. Tareas programadas

Nada es estrictamente obligatorio, porque el motor es determinístico: liquidar tarde da el mismo
resultado que liquidar a tiempo. Aun así, conviene:

| Tarea | Frecuencia | Qué hace |
|---|---|---|
| Liquidación de vencimientos | 1 min | `settleDueSimulations` para todos los usuarios con posiciones abiertas |
| Limpieza de contadores | 1 h | `pruneExpired` sobre `RateLimitCounter` |
| Limpieza de sesiones | 1 día | Borra sesiones caducadas |
| Comprobación de proveedores | 5 min | `healthCheck` y actualización de `DataProviderRecord` |
| Coste de IA | 1 h | `monthlyCostUsd(true)` y alerta al 80 % del tope |
| Informe semanal | 1 semana | Genera el informe de los usuarios Premium |
| Progreso de retos | 1 h | `refreshChallengeProgress` |

Hoy la liquidación se ejecuta de forma oportunista al cargar el panel o la terminal, que cubre el
caso normal. La tarea programada cubre al usuario que no vuelve.

## 7. Observabilidad

Qué vigilar, en orden de importancia:

1. **Integridad del libro mayor** — cualquier divergencia entre saldo y suma de asientos es un
   incidente grave. `/admin/simulaciones` lo comprueba en cada carga.
2. **Guardarraíles de IA activados** — un aumento repentino sugiere una regresión del prompt o un
   cambio de comportamiento del modelo.
3. **Coste de IA** — alerta al 80 % del tope mensual.
4. **Salud del proveedor de datos** — latencia y errores.
5. **Errores de webhook** — visibles en `/admin/suscripciones`.
6. **Latencia p95 de la API** y tasa de error 5xx.

## 8. Reversión

El despliegue es reversible salvo por las migraciones de base de datos. Regla práctica: las
migraciones deben ser compatibles hacia atrás durante un despliegue. Añade columnas antes de usarlas
y elimínalas un despliegue después de dejar de usarlas.

Si hay que revertir con una migración ya aplicada, la versión anterior debe poder funcionar con el
esquema nuevo. De ahí la regla anterior.
