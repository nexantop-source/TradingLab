# Publicidad: activación segura

La integración queda cerrada por defecto. Sin aprobación, consentimiento,
publisher ID, slot ID y plan explícito no se carga un script, no se hace una
petición a Google y no se reserva un espacio. Los anuncios automáticos globales
no forman parte de esta implementación: cada unidad se monta manualmente desde
`AdSlot`.

Firebase App Hosting solo hospeda la aplicación: no comercializa el inventario
publicitario. Para este producto web el proveedor programático correcto es
**Google AdSense**; AdMob corresponde a aplicaciones móviles nativas.

## Estado verificado de la cuenta

El 5 de septiembre de 2026 se creó la cuenta con **nexantop@gmail.com**, país de
pagos **Colombia**, después de recibir autorización expresa para aceptar los
términos y enviar el registro. Publisher: **pub-5136116898669374**; client ID:
**ca-pub-5136116898669374**. Son identificadores públicos, no credenciales.

Google rechazó el subdominio Firebase `tradinglab--nexant-87204.us-east4.hosted.app`
como dominio restringido. Se completó el alta con «Aún no tengo un sitio web».
La cuenta está creada, **no aprobada para monetizar**. Quedan pendientes el
perfil del beneficiario de pagos y conectar un dominio aceptado para revisión.
No se compró un dominio, no se añadieron datos bancarios ni se activaron anuncios.
El estado mostrado en administración es este registro manual, no una consulta
en tiempo real a Google. Hasta completar las puertas siguientes, los flags de
Google deben permanecer en `false`/`off`.

[Continuar configuración en AdSense](https://adsense.google.com/adsense/u/8/pub-5136116898669374/onboarding)

La nueva política comercial permite publicidad en **Explore (FREE)** y la bloquea
en **Plus (STANDARD)** y **Pro (PREMIUM)**, tanto en componentes como en APIs.

## Decisión de proveedor

`NEXT_PUBLIC_ADS_PROVIDER` acepta:

- `internal`: campañas directas administradas por TradingLab.
- `google`: unidades manuales de Google AdSense.
- `off`: ningún espacio publicitario.

AdSense es la vía implementada para monetización programática. No mezcles
AdSense y Google Ad Manager en la misma unidad. Si el negocio pasa a GAM, crea
un adaptador GPT separado y conserva exactamente las mismas puertas de plan,
consentimiento, superficie y lazy-load.

## Variables de Google

Todas las variables `NEXT_PUBLIC_*` se incorporan durante el build. Cambiarlas
solo en el runtime no actualiza ni el JavaScript ni la CSP: vuelve a compilar y
desplegar.

```dotenv
NEXT_PUBLIC_ADS_PROVIDER="off"
NEXT_PUBLIC_GOOGLE_ADS_ENABLED="false"
NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT=""
NEXT_PUBLIC_GOOGLE_ADS_TEST_MODE="false"

NEXT_PUBLIC_GOOGLE_AD_SLOT_DASHBOARD_BANNER=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_DASHBOARD_SIDE=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_ACADEMY_FOOTER=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_LESSON_SPONSOR=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_CALENDAR_SPONSOR=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_NEWS_NATIVE=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_PUBLIC_BANNER=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_CHALLENGE_SPONSOR=""
NEXT_PUBLIC_GOOGLE_AD_SLOT_WEEKLY_REPORT_SPONSOR=""
```

El publisher ID debe tener el formato `ca-pub-` más 16 dígitos y cada slot debe
ser el ID numérico entregado por Google. No reutilices el ejemplo de este
repositorio.

## Secuencia de activación

1. Mantén `NEXT_PUBLIC_ADS_PROVIDER=off` y solicita la aprobación del dominio en
   AdSense.
2. Configura una CMP certificada por Google para el tráfico del EEE, Reino Unido
   y Suiza. El control local `tl-ad-consent-v1` es una puerta adicional de UX;
   no reemplaza la CMP ni el TCF cuando estos son obligatorios.
3. Crea unidades manuales. Deja desactivados **Auto ads**, anuncios ancla,
   vignette/interstitial y formatos que se inserten fuera de los slots.
4. Implementa nonce por petición y CSP estricta antes de producción. La guía
   vigente de Google indica que una allowlist estática no está soportada porque
   sus dominios cambian: [CSP para AdSense](https://support.google.com/adsense/answer/16283098?hl=es).
5. Añade publisher y slot IDs como secretos/configuración del despliegue, activa
   `NEXT_PUBLIC_GOOGLE_ADS_ENABLED=true`, compila y despliega primero a staging.
6. Pasa siempre `plan={auth.user.plan}` desde el Server Component a cada
   `AdSlot`. En modo Google el componente falla cerrado si no recibe el plan;
   esto evita una petición externa y un hueco para Plus y Pro.
7. Verifica en staging consentimiento aceptado/rechazado, planes Free/Standard/
   Premium, móvil/escritorio y todas las superficies prohibidas.
8. Copia **exactamente** la línea que entrega AdSense a `public/ads.txt`. El
   repositorio solo incluye `public/ads.txt.example`, que no se sirve en la ruta
   estándar y no autoriza a ningún vendedor.
9. Cambia `NEXT_PUBLIC_ADS_PROVIDER=google`, recompila y despliega. Vigila fill,
   CLS, viewability, Core Web Vitals y tráfico inválido durante el rollout.

Nunca hagas clic en anuncios propios ni pidas al equipo o a usuarios que lo
hagan. Separa tráfico interno/QA y usa `NEXT_PUBLIC_GOOGLE_ADS_TEST_MODE=true`
solo en staging.

## Consentimiento y carga

Google se carga únicamente después de leer `granted` en
`tl-ad-consent-v1`. Las unidades empiezan a cargar a 700 px del viewport. El
contenedor reserva un tamaño estándar por breakpoint antes del request; un
no-fill o error se sustituye por contenido propio contextual sin seguimiento y
sin colapsar la geometría.

Si una persona revoca el consentimiento después de haber cargado Google, no se
crean unidades nuevas. La CMP de producción debe propagar además la revocación
a Google; una recarga limpia el código ya cargado de la página actual.

## CSP y staging

`next.config.ts` solo añade una allowlist mínima de staging cuando
`NEXT_PUBLIC_GOOGLE_ADS_ENABLED=true` durante el build. No la consideres una
configuración productiva: Google advierte que sus dominios cambian y actualmente
solo soporta una CSP estricta con nonce, `strict-dynamic` y el nonce aplicado a
todo script, incluido AdSense. El repositorio ya tenía esa migración de nonce
marcada como pendiente en `docs/SECURITY.md`; por eso Google debe permanecer en
`off` hasta completarla.

Antes de producción, prueba la política en staging. Puedes duplicarla como
`Content-Security-Policy-Report-Only` apuntando a un colector propio para revisar
violaciones reales, sin retirar la política enforced ni abrir comodines.

Si Google documenta un origen nuevo, añádelo de manera explícita al tipo de
directiva correcto (`script-src`, `connect-src` o `frame-src`) después de
validarlo; no uses `*.google.com` como atajo.

## Motor directo y eventos

Las campañas internas requieren:

```dotenv
ADS_EVENT_TOKEN_SECRET="genera-al-menos-32-caracteres-aleatorios"
```

Sin ese secreto, `/api/ads/serve` devuelve no-fill. Cada creatividad servida
lleva un recibo HMAC de dos horas ligado a creatividad, campaña, slot, página y
sesión/cliente. `/api/ads/event` vuelve a validar el recibo, la relación real en
base de datos, fechas, estados, anunciante, placement, superficie, plan y
origen. Viewability solo puede modificar la impresión exacta creada por ese
recibo.

El gasto CPM se calcula sobre el acumulado (`floor(impresiones × CPM / 1000)`),
por lo que no se redondea y cobra cada impresión por separado.

### Límite conocido de idempotencia multi-instancia

El esquema actual no tiene una clave de evento única. Hay una defensa de replay
por `jti + tipo` compartida dentro de cada proceso, además de token corto,
binding y rate limit. Eso bloquea dobles callbacks/reintentos en una instancia,
pero no puede garantizar unicidad entre dos instancias o después de un reinicio.

Antes de facturar campañas directas en un despliegue horizontal, añade una tabla
persistente `AdEventReceipt` (o un `eventKey`) con índice `UNIQUE`, inserta la
huella `SHA-256(jti + tipo)` en la misma transacción que la impresión/clic y
considera la violación de unicidad como un replay exitosamente ignorado. No se
incluye una migración automática aquí para no alterar datos existentes sin una
ventana de despliegue acordada.

Por esta razón `apphosting.yaml` mantiene `ADS_PROVIDER=off`. El cliente puede
mostrar piezas propias de respaldo en los espacios ya diseñados, pero el backend
no sirve ni factura campañas directas hasta cerrar esa migración.
