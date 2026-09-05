# Cuenta Wompi compartida: TradingLab y Nexant

URL de producción: `https://tradinglab--nexant-87204.us-east4.hosted.app/api/payments/wompi/events`.

## Contrato de recepción

- POST JSON, máximo 64 KiB. Firma SHA256 con las propiedades dinámicas de Wompi, `transaction.id` obligatoriamente firmado y ambiente `prod`.
- La URL GET solo verifica configuración, no certifica transacciones ni la disponibilidad de Nexant.
- Cada evento transaccional autenticado se registra en `WebhookEvent` (`provider=wompi-hub`) antes de consultar la API. No se guardan email ni datos de tarjeta.
- Solo el ID firmado selecciona la consulta a Wompi. Referencia, monto y enlace usados para enrutar/acreditar provienen de esa respuesta autoritativa.
- Referencias `tl_` válidas: TradingLab. Referencias `sub_`, `product_`, `NX-IBAGUE-INICIAL-` y enlaces Wompi: Nexant, que vuelve a verificar con Wompi y comprueba sus órdenes. Las propuestas privadas se registran para revisión comercial, sin conceder acceso SaaS.
- Referencias desconocidas: registro pendiente y HTTP 409, nunca acreditación por defecto.
- Un fallo no recibe HTTP 200. Wompi reintenta a los 30 minutos, 3 horas y 24 horas. No hay cola de reintentos autónoma adicional.
- `processedAt` se guarda después de reconciliar o recibir HTTP 200 + `{received:true}` de Nexant. Reenvíos completados son idempotentes; reconciliación de TradingLab usa transacciones serializables y bloqueo por usuario.
- La recepción de pagos existentes no depende de que se permitan nuevos checkouts.

## Operación y recuperación

Antes de habilitar nuevas compras: verificar build servido, firma correcta/incorrecta con eventos no transaccionales, rechazo de JSON vacío, disponibilidad de secretos y pruebas automatizadas. Estas comprobaciones no crean un pago real y no sustituyen una prueba de extremo a extremo con el titular.

Si falla un destino, reparar su configuración/despliegue sin desactivar recepción. Consultar en la base los registros `wompi-hub` con `processedAt=null`; sus errores e IDs permiten cotejar las transacciones en Wompi. Solicitar reenvío de notificaciones si corresponde. No marcar `processedAt` manualmente ni conceder acceso usando solamente la redirección del checkout. Si el plazo de reintentos se agotó, hace falta reconciliación operativa explícita; no asumir recuperación automática.

## Activación y reversión

`WOMPI_EVENT_HUB_ENABLED=true` mantiene la recepción. `BILLING_PROVIDER=wompi` permite nuevas compras; para pausar ventas, volver solamente este último a `disabled` y desplegar. No volver a la URL Shopify/Conexa retirada.

Precio de TradingLab mostrado USD; importe COP calculado con TRM SFC vigente y congelado por intento. Un pago compra un periodo: NO existen mandatos ni débitos recurrentes automáticos en esta entrega. La llave privada no se necesita para Checkout Web y no se incorpora al cliente.

Fuente: https://docs.wompi.co/docs/colombia/eventos/

## Evidencia de entrega — 5 de septiembre de 2026

- Nexant `e1d6829`: build `build-2026-09-05-005` READY, rollout SUCCEEDED y tráfico 100 %.
- Hub TradingLab `ba7ecc8`: build `build-2026-09-05-008` READY, rollout SUCCEEDED y tráfico 100 % antes de habilitar checkout.
- Ambos receptores públicos: firma inválida HTTP 401; firma válida de evento no transaccional HTTP 200 / ignored. No se creó transacción Wompi.
- 234 pruebas unitarias/de contrato aprobadas. `npm run test:wompi:integration` usa una SQLite temporal real y respuestas de Wompi simuladas: checkout idempotente, acceso pendiente bloqueado, activación única, no duplicación del periodo, Nexant fallido persistido y reintento recuperado.
- TRM oficial consultada correctamente: vigencia 2026-09-05 a 2026-09-08. Cada compra consulta su propia vigencia, sin hardcodear esta tasa.
- No se realizó pago con dinero real. El ensayo completo en Wompi con un medio de pago real sigue pendiente del titular.
