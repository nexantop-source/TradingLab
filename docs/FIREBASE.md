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

Ya hecho:

- Proyecto de Firebase creado: **`tradinglab-app`**
  ([consola](https://console.firebase.google.com/project/tradinglab-app/overview)).
- `.firebaserc` apunta a ese proyecto, así que la CLI ya sabe con cuál trabajar.
- `apphosting.yaml` con la configuración de ejecución, variables y referencias a secretos.
- `prisma/schema.prisma` con el objetivo binario que necesita Cloud Run.
- Build verificado con el proveedor `postgresql`, tal como se ejecutará en Firebase.
- Repositorio en GitHub: `nexantop-source/TradingLab`.

Pendiente, y requiere tu intervención porque implica facturación y una autorización en el navegador:

1. Activar el plan Blaze.
2. Crear la base de datos PostgreSQL.
3. Crear los dos secretos.
4. Crear el backend y autorizar el acceso a GitHub.

---

## Paso a paso

### 1. Activar el plan Blaze

App Hosting usa Cloud Run y Cloud Build, que no están en el plan gratuito.

https://console.firebase.google.com/project/tradinglab-app/usage/details

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
firebase apphosting:secrets:set DATABASE_URL --project tradinglab-app
# pega la cadena de conexión de PostgreSQL

firebase apphosting:secrets:set AUTH_SECRET --project tradinglab-app
# pega un valor generado con:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
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

```bash
firebase apphosting:backends:create --project tradinglab-app --backend tradinglab --primary-region us-central1 --root-dir "/"
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

**El esquema sigue en SQLite.**
`DATABASE_PROVIDER` debe valer `postgresql` con disponibilidad `BUILD`. El script
`scripts/set-db-provider.mjs` reescribe el esquema durante la compilación.

---

## Si aun así quieres Firebase Hosting

Solo tiene sentido como capa de CDN **delante** de App Hosting, no en su lugar. Firebase lo hace
automáticamente cuando conectas un dominio personalizado al backend de App Hosting: el contenido
estático se sirve desde la CDN y las peticiones dinámicas van a Cloud Run.

Lo que no se puede es sustituir uno por otro. Sin servidor no hay sesiones, ni API, ni base de
datos, ni simulaciones.
