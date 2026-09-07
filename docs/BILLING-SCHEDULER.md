# Programador de cobros

`POST /api/billing/charge-due` cobra las suscripciones cuya prueba gratuita ha
vencido. Es el único punto donde una prueba se convierte en una suscripción de
pago.

**Sin un programador que lo invoque, ninguna prueba convierte.** Vencen, dejan
de conceder acceso y se quedan ahí: nadie cobra y nadie se entera. El endpoint
existía y estaba probado desde antes, pero no había nada llamándolo.

## Cómo se autentica

No por cookie: quien llama es una máquina, no una persona. Se comparte el
secreto `PUSH_DISPATCH_SECRET` con el despachador de notificaciones, porque
ambos son el mismo tipo de invocador de confianza, y se compara en tiempo
constante.

Sin el secreto configurado la ruta responde `503` y **no cobra nada**, en lugar
de quedar abierta. Una ruta de cobro accesible sin credencial es dinero de
otras personas al alcance de cualquiera.

## Crear el trabajo

Una vez, desde una consola con permisos sobre el proyecto:

```bash
PROYECTO=nexant-87204
REGION=us-east4
APP=https://tradinglab--nexant-87204.us-east4.hosted.app
SECRETO="$(gcloud secrets versions access latest \
  --secret=TRADINGLAB_PUSH_DISPATCH_SECRET --project="$PROYECTO")"

gcloud scheduler jobs create http tradinglab-cobros-vencidos \
  --project="$PROYECTO" \
  --location="$REGION" \
  --schedule="20 13 * * *" \
  --time-zone="America/Bogota" \
  --uri="$APP/api/billing/charge-due" \
  --http-method=POST \
  --headers="Authorization=Bearer $SECRETO,Content-Type=application/json" \
  --message-body='{}' \
  --attempt-deadline=540s \
  --max-retry-attempts=3 \
  --min-backoff=60s \
  --max-backoff=600s
```

### Por qué esa hora

`20 13 * * *` es las 13:20, hora de Bogotá. Tres razones:

- **Después de la apertura de los mercados**, no antes: el estado de la
  suscripción se calcula con datos que ya se movieron ese día.
- **No en punto.** Todo el mundo programa a las 13:00; los minutos raros
  reparten la carga y hacen que un fallo se distinga del ruido.
- **Una vez al día basta.** El vencimiento se decide por fecha, no por hora, y
  ejecutar más a menudo no adelanta ningún cobro: solo multiplica las
  oportunidades de cobrar dos veces si algo va mal.

### Por qué reintentos con espera creciente

Un timeout ambiguo -la petición sale, la respuesta se pierde- no significa que
el cobro no ocurriera. El servicio marca la fecha de cobro como consumida antes
de responder, así que un reintento no vuelve a cobrar; la espera creciente
evita insistir sobre un incidente que aún dura.

## Comprobar que funciona

```bash
# Lanzarlo a mano una vez y leer el informe.
gcloud scheduler jobs run tradinglab-cobros-vencidos \
  --project="$PROYECTO" --location="$REGION"

# El informe queda en los registros del servicio.
gcloud logging read \
  'resource.type="cloud_run_revision" AND textPayload:"charge-due"' \
  --project="$PROYECTO" --limit=20
```

La respuesta es un informe con cinco cifras:

```json
{ "due": 3, "submitted": 3, "declined": 0, "skipped": 0, "errors": 0 }
```

- `due` — suscripciones cuya prueba venció y tenían cobro programado.
- `submitted` — cobros enviados a Wompi. Quedan `PENDING`: **no conceden acceso
  todavía**. Lo concede el webhook cuando Wompi confirma la aprobación.
- `declined` — el banco rechazó. La suscripción no queda a medias.
- `skipped` — canceladas o sin mandato vigente. Cancelar durante la prueba tiene
  que impedir el cobro, y esta cifra es la que lo demuestra.
- `errors` — fallos nuestros o de la pasarela. Cualquier valor distinto de cero
  merece que alguien lo mire.

`due` y `submitted` deberían coincidir salvo cancelaciones. Si `due` es cero
día tras día y sabes que hay pruebas venciendo, el trabajo no está llegando:
revisa el secreto antes que ninguna otra cosa.

## Qué vigilar

- Una alerta sobre `errors > 0` en la respuesta.
- Una alerta si el trabajo no se ejecuta en 36 horas. Un cobro que no sale no
  produce ningún síntoma visible: nadie se queja de que no le cobren.

## Relacionado

- `docs/WOMPI-EVENTS.md` — el webhook que confirma el cobro y concede el acceso.
- `docs/WOMPI-READINESS.md` — qué hay que demostrar antes de activar producción.
- `scripts/qa-trial-sandbox.mts` — el ciclo completo contra el sandbox real,
  incluida una tarjeta que el banco rechaza.
