# Checkout y planes: QA del 20 de septiembre de 2026

## Resultado y alcance

Planes y checkout comparten diseño azul, límites comparables y precios Plus USD 5.99/mes y Pro USD 19.99/mes. La vista anual distingue equivalente mensual y total anual. El checkout permite revisar el total en COP antes de abrir Wompi y separa pago único de prueba con renovación. Se revisaron escritorio y móvil de 390 px, consentimiento sin marcar, cambio de plan/periodo y reinicio del importe preparado. El saldo virtual queda fuera del encabezado de planes y pago.

## Controles de pago

- El proveedor por defecto queda desactivado: no se conceden planes por un mock implícito. Los registros mock se identifican y no habilitan funciones en producción.
- Wompi sandbox no se acepta en ejecución de producción. Los trials antiguos sin evidencia de verificación o con fuente sandbox no habilitan funciones en producción.
- Validación local de número, caducidad y CVC para errores de captura. Esto no prueba que exista una tarjeta: la activación requiere aprobación de Wompi, referencia, moneda e importe coincidentes.
- La prueba informa del cargo de verificación de COP 1.500, solicitud de anulación, renovación y cancelación. No se presenta como ausencia absoluta de cargos. Se confirma el estado VOIDED; aceptar una solicitud de anulación no equivale a completar la anulación.
- La consulta de transacciones usa la llave privada exclusivamente en servidor. Wompi documenta que las consultas con llave pública ya no están soportadas: https://docs.wompi.co/docs/colombia/transacciones/
- Límite de intentos por usuario, exclusión de verificaciones simultáneas y una prueba por cuenta. Intentos inciertos quedan registrados por referencia para revisión; no se repite automáticamente una validación cuyo resultado se desconoce.
- La renovación reclama el cobro atómicamente antes de llamar a Wompi. Un timeout posterior al envío queda pendiente de conciliación, sin otro cobro automático.

## Evidencia

- Suite automatizada: 545 pruebas, 49 archivos aprobados; incluye tarjetas rechazadas, importe/moneda/referencia incorrectos, firma inválida, repetición de eventos, consultas privadas, anulaciones asíncronas y cobros concurrentes.
- `scripts/qa-wompi-local.ts`: base SQLite desechable, cero solicitudes externas. Pago pendiente no concede acceso; aprobación activa una vez; bloquea duplicados; fallo y recuperación de entrega de eventos; aislamiento de proyectos.
- `scripts/qa-trial-sandbox.mts`: API real del ambiente sandbox y SQLite desechable. Tarjeta aprobada concede prueba con evidencia; cargo de validación anulado; tarjeta rechazada no crea suscripción ni mandato; segunda prueba bloqueada; cancelación evita cobro; renovación queda pendiente hasta conciliación; repetir el ciclo no vuelve a cobrar.
- Consulta de lectura con llave privada de la verificación sandbox `172902-1789945570-86084`: `VOIDED`, COP 1.500.
- `npm run typecheck` aprobado. Compilación de producción validada por `npm run build`.

## Límites y operación

No se realizaron cargos de dinero real ni se auditó la base de usuarios de producción. Las tarjetas ficticias aprobadas de sandbox son datos de prueba deliberados de Wompi, no evidencia de aceptación bancaria en producción: https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/

Antes de habilitar ventas, el despliegue debe disponer de BILLING_PROVIDER=wompi, WOMPI_ENVIRONMENT=production, llaves de producción pública/privada, secretos de integridad/eventos, origen HTTPS correcto, webhook y tarea de cobros configurados. Los valores privados no se incluyen en este informe ni en Git. La prueba con tarjeta se oculta si falta configuración requerida.

Los registros WOMPI_VERIFICATION con REVIEW_REQUIRED necesitan seguimiento en auditoría y conciliación con el panel Wompi. Si una anulación no se confirma, soporte debe resolverla y comprobar la liberación bancaria; la interfaz avisa al usuario. No hay resolución automática de todos los incidentes bancarios.

La verificación corresponde a una cuenta y una fuente de pago; no es una comprobación de identidad ni impide por sí sola que una persona cree otras cuentas. La validación final del checkout, webhook y renovación en el comercio de producción sigue pendiente de una operación real controlada por el titular.

## Reproducción local

`node --conditions=react-server --import tsx scripts/qa-wompi-local.ts`

`node --conditions=react-server --import tsx scripts/qa-trial-sandbox.mts`

El segundo comando requiere `.env.wompi.sandbox.local` y se niega a ejecutar otro ambiente. `scripts/qa-checkout-preview.mjs` levanta una vista aislada en http://localhost:3020/entrar, con cuenta QA y precios COP de ejemplo; no modifica la base habitual. Sus importes fijos son fixtures de QA, no una TRM de producción.

## Verificación posterior en producción

20 de septiembre de 2026, Bogotá: Firebase confirmó rollout SUCCEEDED, build READY y 100% del tráfico en 3b2663613ea5af5afb8369e065cfe64da5a6a9ce. Cloud Run tiene BILLING_PROVIDER=wompi, ambiente production y origen HTTPS correcto. Se comprobaron las versiones de secretos efectivamente referenciadas por la revisión: las cuatro credenciales Wompi tienen prefijo de producción. No fue necesario rotarlas.

El comercio de Wompi production respondió 200 y entregó los tokens de aceptación requeridos. Precios, login, registro y receptor devolvieron 200. El receptor rechazó una firma inválida con 401 e ignoró correctamente una notificación firmada sin transacción con 200. Esta comprobación fue enviada por el script QA, no por el panel de Wompi: no demuestra la entrega de un pago real desde Wompi.

Se detectaron dos programadores de cobros activos. Se pausó tradinglab-cobros-vencidos y se conservó tradinglab-charge-due, horario, con credencial coincidente y última ejecución sin error. Se alineó billing-scheduler.mjs con el nombre canónico. La segunda ejecución de qa-wompi-production.mjs pasó todas las comprobaciones sin crear usuarios, tarjetas, transacciones ni cargos.

Solo permanece pendiente la operación real controlada por el titular, su notificación efectiva desde Wompi y la liquidación bancaria. No se dispone de una tarjeta del titular ni se ha ejecutado un cargo en su nombre.
