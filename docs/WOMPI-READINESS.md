# Wompi: activación y renovaciones

Revisión: 5 de septiembre de 2026. **No acredita cobros activos.**

Actualización: el usuario eligió producción y ya configuró la URL compartida.
Las llaves fueron cotejadas con Secret Manager sin exponerlas. El backend
compartido y el receptor Nexant se implementaron; ver `WOMPI-EVENTS.md` para
el contrato, activación, pruebas y límites de recuperación. El estado histórico
de abajo describe el punto de partida, no sustituye verificar el build servido.

## Evidencia actual

- La consulta pública de `/api/billing/status` devuelve 404 / `BILLING_PROVIDER_UNAVAILABLE`.
- `apphosting.yaml` selecciona `BILLING_PROVIDER=disabled`. Hay referencias a secretos de llave pública, integridad y eventos; no una referencia de llave privada para transacciones iniciadas por servidor.
- La implementación actual genera un checkout por un periodo. El texto de compra y los términos excluyen expresamente débitos recurrentes; esas compras no constituyen un mandato de renovación.
- Existe `/api/billing/webhook`: limita el cuerpo, comprueba firma y ambiente, consulta la transacción a Wompi y reconcilia de forma idempotente. No existe aún un hub compartido operativo con Nexant.
- El propietario confirmó que la URL Shopify/Conexa ya no se usa. Se puede sustituir cuando el nuevo destino esté desplegado y verificado; esta confirmación no significa que el cambio ya se haya realizado.

## Lo que permite Wompi

[Fuentes de pago](https://docs.wompi.co/docs/colombia/fuentes-de-pago/): una fuente autorizada permite transacciones posteriores; su creación y el cobro utilizan la llave privada exclusivamente en servidor. Los detalles sensibles deben permanecer en Wompi, no en TradingLab. Deben gestionarse los tokens de aceptación y la autorización de datos del pagador.

[3RI](https://docs.wompi.co/docs/colombia/fuentes-de-pago-3ds/): revisar los requisitos de autenticación del método elegido y la habilitación del comercio antes de diseñar la ruta definitiva.

[Eventos](https://docs.wompi.co/docs/colombia/eventos/): configurar una URL HTTPS verificable y procesar notificaciones con validación de autenticidad. Un retorno del navegador no demuestra por sí solo un pago.

## Trabajo necesario antes de activación recurrente

1. Resolver la conexión existente y el destino compartido TradingLab/Nexant. Si se usa un hub, allowlist fija de destinos, separación por proyecto/referencia verificada, reintentos durables e idempotencia por consumidor; no un proxy abierto ni un envío indiscriminado a ambas cuentas.
2. Verificar los eventos en un entorno de prueba completo antes de ofrecer enlaces cobrables. No activar únicamente por detectar que existen secretos.
3. Crear un mandato de débito específico: propietario, producto, versión de consentimiento, frecuencia, fecha, precio USD, regla TRM→COP, autorización y cancelación. No preseleccionado, no retroactivo a compras existentes.
4. Crear la fuente de pago vinculada al usuario autenticado y verificarla con Wompi. No aceptar un `payment_source_id` arbitrario del cliente. Nunca guardar PAN/CVC, tokens crudos del formulario ni claves en la PWA, logs o analítica.
5. Registrar un intento único por periodo, importe COP congelado y referencia estable antes de llamar a Wompi. Controlar concurrencia y timeouts ambiguos: consultar/reconciliar antes de repetir una solicitud; una referencia no se debe asumir como garantía de idempotencia de la pasarela.
6. Ejecutar vencimientos en un servicio de backend con autenticación, no en el navegador ni en una automatización de conversación. Parar inmediatamente futuros intentos tras cancelación y conservar el acceso ya pagado.
7. Distinguir pendiente, aprobado, rechazado, error y revisión manual. Pruebas de duplicados, concurrencia, cancelación durante ejecución, fin de mes/año bisiesto, TRM ausente, fuente revocada y aprobación tardía.
8. Habilitar producción después de demostrar el flujo. Los ensayos no deben cobrar a clientes ni usar tarjetas reales sin autorización específica del titular.

La PWA es independiente de este cambio: esta revisión no crea mandatos, fuentes de pago, cron de cobros ni transacciones.
