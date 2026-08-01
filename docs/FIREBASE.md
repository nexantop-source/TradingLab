# Despliegue en Firebase

## Por qué App Hosting y no Hosting

**Firebase Hosting no puede ejecutar esta aplicación.** Hosting sirve archivos estáticos desde una
CDN. TradingLab depende del servidor en casi todo:

- Sesiones con cookie `httpOnly` verificadas en el servidor.
- 24 rutas de API (simulaciones, IA, academia, publicidad, facturación).
- Prisma contra una base de datos.
- El motor de simulación y los guardarraíles de IA, que **no deben** ejecutarse en el navegador:
  ahí el usuario podría manipularlos.

Un `next export` estático dejaría la landing y las páginas legales, y nada más. Ni registro, ni
terminal, ni academia, ni panel.

**Firebase App Hosting** sí sirve: construye desde GitHub y ejecuta Next.js sobre Cloud Run con
renderizado en servidor. Es el producto correcto para este caso, y el repositorio ya viene
configurado para él.

---

## Requisitos previos

1. Proyecto de Firebase en **plan Blaze** (App Hosting usa Cloud Run y Cloud Build; el plan gratuito
   no los incluye).
2. El repositorio en GitHub (ya lo está).
3. Firebase CLI actualizado: `npm i -g firebase-tools`.
4. **Una base de datos PostgreSQL.** Cloud Run tiene un sistema de archivos efímero que no se
   comparte entre instancias, así que SQLite no vale en producción: cada instancia tendría su propia
   base y se perdería al reiniciar.

### Opciones de base de datos

| Opción | Cuándo elegirla |
|---|---|
| **Neon** | La más rápida de poner en marcha. Tiene plan gratuito y pooling incluido, que es justo lo que necesita Cloud Run. |
| **Supabase** | Si además quieres su panel de administración de datos. |
| **Cloud SQL** | Si prefieres todo dentro de Google Cloud. Requiere conector de VPC y no tiene plan gratuito. |

Con Neon o Supabase, usa la cadena de conexión **con pooling** (la que incluye `-pooler` o
`pgbouncer=true`). Prisma en serverless abre una conexión por invocación y sin pooling se agotan.

---

## Estado actual

**Desplegado y funcionando.**

| | |
|---|---|
| Proyecto | `nexant-87204` |
| Backend | `tradinglab` · `us-east4` · `nodejs24` |
| Repositorio | `nexantop-source/TradingLab`, rama `main`, despliegue automático |
| URL | https://tradinglab--nexant-87204.us-east4.hosted.app |
| Base de datos | Cloud SQL `tradinglab-db` · PostgreSQL 16 · `us-east4` · `db-f1-micro` |
| Secretos | `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY` |

Todo vive en el mismo proyecto de Firebase. Cloud SQL es el motor relacional que usa Firebase para
Data Connect, así que Prisma se conecta sin ningún cambio de código.

También se creó el proyecto `tradinglab-app`, que quedó sin usar porque no tiene Blaze. Puedes
borrarlo desde la consola.

### Por qué no Firestore

Es la primera pregunta que surge y conviene dejarla escrita. Firestore es documental y Prisma no
tiene conector para él, pero el problema de fondo es otro: el producto depende de garantías que
Firestore no ofrece.

- **Transacciones ACID entre tablas.** Cada simulación escribe tres asientos en el libro mayor que
  deben cuadrar o no escribirse ninguno. Es la base de la auditoría del saldo virtual.
- **Agregaciones `groupBy`.** Sostienen el panel administrativo entero: versiones del motor,
  proveedores de precio, uso y coste de IA, métricas de campañas. Firestore no tiene `GROUP BY`;
  habría que mantener contadores a mano o exportar a BigQuery.
- **Relaciones y claves únicas compuestas** en los 47 modelos.

Migrar habría supuesto reescribir la capa de datos, las 24 rutas de API y el panel, para acabar con
menos garantías de las que hay ahora.

### Nota de seguridad sobre Cloud SQL

App Hosting no expone conexión por socket a Cloud SQL en su configuración, así que la instancia
necesita **IP pública**. Se ha configurado con la postura más estricta que permite esa restricción:

- `sslMode: ENCRYPTED_ONLY` — una conexión sin cifrar se rechaza **en el servidor**, no solo por
  convención del cliente.
- Contraseña de 32 bytes aleatorios, generada y enviada directamente a Secret Manager sin pasar por
  disco ni por pantalla.
- Copias de seguridad diarias activadas.

Aun así, la base queda alcanzable desde internet y la protección descansa en la contraseña y en TLS.
Es la concesión que impone hoy la plataforma. Cuando App Hosting soporte salida por VPC, conviene
pasar a IP privada y retirar la red autorizada `0.0.0.0/0`.

### Utilidades

```bash
node scripts/provision-cloudsql.mjs    # crea o reutiliza instancia, base y usuario
node scripts/db-remote.mjs push        # crea o actualiza las tablas desplegadas
node scripts/db-remote.mjs migrate     # aplica migraciones pendientes
node scripts/db-remote.mjs seed        # carga el catálogo
node scripts/db-remote.mjs studio      # inspector contra la base real
```

`db-remote.mjs` lee la cadena de conexión desde Secret Manager, en lugar del patrón habitual de
pegar la contraseña en la terminal o dejarla en un `.env` que acaba versionado por descuido.

Para rotar la contraseña:

```bash
PRINT_URL=1 node scripts/provision-cloudsql.mjs \
  | firebase apphosting:secrets:set DATABASE_URL --project nexant-87204 --data-file -
```

---

## Paso a paso

### 1. Plan Blaze

Ya está activo en `nexant-87204`. Si trabajas en otro proyecto, actívalo antes: App Hosting usa
Cloud Run y Cloud Build, que no están en el plan gratuito.

Con tráfico bajo y `minInstances: 0` el coste real tiende a cero, pero hace falta un método de pago
asociado. Conviene además fijar un presupuesto con alerta en Google Cloud Billing.

### 2. Preparar la base de datos

Crea la base en tu proveedor y guarda la cadena de conexión. Después, desde tu máquina, crea el
esquema:

```bash
# .env local apuntando temporalmente a la base de producción
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://…"

npm run db:push          # crea las 47 tablas
npm run db:seed          # opcional: catálogo + cuentas de demostración
```

> **Sobre la semilla en producción.** `npm run db:seed` crea también tres usuarios de demostración
> con contraseñas conocidas. Para un entorno real conviene sembrar solo el catálogo (planes,
> instrumentos, academia, glosario, documentos legales, inventario publicitario) y omitir la función
> `seedUsers()` de `prisma/seed.ts`.

### 3. Crear los secretos

Nunca van en `apphosting.yaml` ni en el repositorio.

```bash
firebase apphosting:secrets:set DATABASE_URL --project nexant-87204
# pega la cadena de conexión de PostgreSQL

firebase apphosting:secrets:set AUTH_SECRET --project nexant-87204
# pega un valor generado con:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# Sin este paso, el backend no puede leerlos aunque existan:
firebase apphosting:secrets:grantaccess DATABASE_URL,AUTH_SECRET \
  --backend tradinglab --project nexant-87204
```

> `AUTH_SECRET` firma las sesiones. Si cambia entre despliegues, todas las sesiones activas se
> invalidan y los usuarios tienen que volver a entrar. Genéralo una vez y no lo toques.

Opcional, para activar el modelo de lenguaje. Sin él, el entrenador responde con el motor
determinístico local, que aplica exactamente las mismas reglas de conducta:

```bash
firebase apphosting:secrets:set OPENAI_API_KEY
```

Y descomenta el bloque correspondiente al final de `apphosting.yaml`.

### 4. Crear el backend y conectar GitHub

Este paso **ya está hecho** para `nexant-87204`. Se documenta para poder recrearlo o levantar un
entorno de staging:

```bash
firebase apphosting:backends:create --project nexant-87204 --backend tradinglab --primary-region us-east4 --root-dir "/"
```

Ejecútalo de forma interactiva: la conexión con GitHub abre una autorización en el navegador que no
puede automatizarse.

El asistente pide:

- **Repositorio de GitHub** → `nexantop-source/TradingLab` (autoriza la app de Firebase si es la
  primera vez).
- **Rama de despliegue** → `main`.
- **Despliegues automáticos** → sí. A partir de aquí, cada `git push` a `main` despliega solo.
- **Identificador del backend** → `tradinglab`.

### 5. Primer despliegue

Se lanza solo al crear el backend. Para forzar uno:

```bash
git commit --allow-empty -m "Desplegar"
git push origin main
```

Sigue el progreso en la consola de Firebase, sección **App Hosting**.

### 6. Comprobar

La URL la muestra la consola al terminar el despliegue, con la forma:

```
https://tradinglab--<hash>.us-central1.hosted.app
```

Cópiala a `NEXT_PUBLIC_APP_URL` en `apphosting.yaml` y vuelve a desplegar, para que los metadatos de
Open Graph y los enlaces absolutos apunten al sitio real.

Lista de verificación tras el primer despliegue:

- [ ] La landing carga con el gráfico del hero.
- [ ] `/precios`, `/mercados`, `/legal` responden.
- [ ] Puedes crear una cuenta y recibes los USD 10.000 virtuales.
- [ ] El onboarding se completa y clasifica tu nivel.
- [ ] La terminal dibuja el gráfico y deja crear una simulación.
- [ ] El entrenador devuelve un análisis (con el motor determinístico si no configuraste OpenAI).

---

## Después del despliegue

### Ajustar la URL pública

Cuando conectes un dominio, cambia `NEXT_PUBLIC_APP_URL` en `apphosting.yaml` y vuelve a desplegar.
Se usa en los metadatos de Open Graph y en los enlaces absolutos.

### Migraciones de esquema

App Hosting **no** ejecuta migraciones durante el build, y es lo correcto: una migración fallida a
mitad de un despliegue deja la base en un estado incierto. Ejecútalas tú antes de hacer push:

```bash
DATABASE_PROVIDER=postgresql DATABASE_URL="postgresql://…" npm run db:migrate
git push origin main
```

Regla práctica: las migraciones deben ser compatibles hacia atrás durante un despliegue. Añade
columnas antes de usarlas y elimínalas un despliegue después de dejar de usarlas. Así la versión
anterior sigue funcionando si hay que revertir.

### Coste

`minInstances: 0` en `apphosting.yaml` significa que no se paga nada mientras no haya tráfico, a
cambio de un arranque en frío de unos segundos en la primera visita. Si prefieres respuesta
inmediata, sube a `minInstances: 1`, que ya tiene coste fijo.

El tope de gasto de IA está en `AI_MONTHLY_COST_CAP_USD: "50"`. Al alcanzarlo, los análisis pasan al
motor determinístico local en lugar de fallar, y la interfaz indica qué motor los generó.

### Emulador local

```bash
firebase emulators:start --only apphosting
```

Levanta la aplicación en `localhost:5002` con la configuración de `apphosting.yaml`, útil para
comprobar variables de entorno antes de desplegar.

---

## Problemas frecuentes

**`build step 1 "…/preparer:…" failed: step exited with non-zero status: 100`.**
Es el error más común y casi siempre significa lo mismo: **`apphosting.yaml` referencia un secreto
que no existe** en el proyecto del backend, o al que la cuenta de servicio no tiene acceso.

El paso `preparer` resuelve los secretos *antes* de compilar, así que falla antes de tocar el
código. Comprueba cuáles existen:

```bash
firebase apphosting:secrets:describe DATABASE_URL --project <proyecto>
firebase apphosting:secrets:describe AUTH_SECRET  --project <proyecto>
```

Si falta alguno, créalo y concede acceso:

```bash
firebase apphosting:secrets:set DATABASE_URL --project <proyecto>
firebase apphosting:secrets:set AUTH_SECRET  --project <proyecto>
firebase apphosting:secrets:grantaccess DATABASE_URL,AUTH_SECRET --backend <backend> --project <proyecto>
```

Cuidado con un detalle fácil de pasar por alto: los secretos son **por proyecto**. Si creaste el
backend en un proyecto distinto de aquel donde creaste los secretos, no se ven entre sí.

Ninguno de los dos se necesita en `BUILD`. Está verificado que `prisma generate` y `next build`
completan sin ellos, así que en este repositorio ambos están declarados solo como `RUNTIME`: cuanto
menos tenga que resolver el `preparer`, menos motivos hay para que falle la compilación.

**`Query engine binary not found` al arrancar.**
Falta el motor de Prisma para el contenedor. Ya está resuelto en el repositorio: el generador de
`prisma/schema.prisma` declara `binaryTargets = ["native", "debian-openssl-3.0.x"]`. Si lo tocas, no
quites ese segundo objetivo.

**`Can't reach database server` intermitente.**
Falta pooling. Usa la cadena de conexión con `-pooler` o añade `?pgbouncer=true&connection_limit=1`.

**El build falla en `prisma generate`.**
`DATABASE_URL` debe estar disponible también en `BUILD`, no solo en `RUNTIME`. Ya está así en
`apphosting.yaml`.

**La sesión no persiste.**
`AUTH_SECRET` debe existir y ser estable. Si cambia entre despliegues, todas las sesiones se
invalidan. Compruébalo con `firebase apphosting:secrets:describe AUTH_SECRET`.

**El sitio carga pero no se puede iniciar sesión, y los registros repiten «modo público».**
Falta `AUTH_SECRET`. La aplicación está diseñada para no caerse por ello: sin secreto, `getAuth()`
trata a todo el mundo como anónimo en lugar de propagar la excepción, de modo que la landing, los
precios y el centro legal siguen en pie. Falla de forma cerrada —nadie obtiene sesión— y el intento
de inicio de sesión devuelve un 503 con un mensaje explícito en lugar de un 500 opaco.

**El esquema sigue en SQLite.**
`DATABASE_PROVIDER` debe valer `postgresql` con disponibilidad `BUILD`. El script
`scripts/set-db-provider.mjs` reescribe el esquema durante la compilación.

**`npm error 404` sobre un paquete durante el paso `build` (estado 51).**
El `package-lock.json` apunta a una URL que no existe. Suele ocurrir tras una búsqueda y reemplazo
sobre todo el repositorio: basta con que la cadena buscada aparezca dentro del nombre de un paquete.

Se detecta mal en local porque npm reutiliza su caché y no llega a pedir el tarball por red. Para
reproducir lo que hace el contenedor, hay que forzar una caché vacía:

```bash
npm ci --cache "$(mktemp -d)"
```

Y para auditar el lockfile entero de una vez:

```bash
node -e "const l=require('./package-lock.json');for(const[k,p]of Object.entries(l.packages)){if(!p.resolved?.includes('registry.npmjs.org'))continue;const n=k.replace(/^node_modules\//,'').split('/node_modules/').pop();const s=n.includes('/')?n.split('/')[1]:n;if(!p.resolved.split('/').pop().startsWith(s+'-'))console.log('INCOHERENTE',n,p.resolved)}"
```

**El entrenador responde siempre con el motor determinístico.**
Mira `/admin/ia`: hay una sección que agrupa por causa los análisis servidos en local. Los motivos
habituales son cuenta del proveedor sin saldo (`QUOTA`), credencial rechazada (`AUTH`) o el
proveedor caído (`UPSTREAM`). Los dos primeros no se reintentan, porque reintentarlos solo añade
espera antes de la misma respuesta.

---

## Si aun así quieres Firebase Hosting

Solo tiene sentido como capa de CDN **delante** de App Hosting, no en su lugar. Firebase lo hace
automáticamente cuando conectas un dominio personalizado al backend de App Hosting: el contenido
estático se sirve desde la CDN y las peticiones dinámicas van a Cloud Run.

Lo que no se puede es sustituir uno por otro. Sin servidor no hay sesiones, ni API, ni base de
datos, ni simulaciones.
