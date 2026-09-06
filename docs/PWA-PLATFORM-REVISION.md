# Revisión de plataforma · 6 de septiembre de 2026

## Cambios

- La explicación escrita ya no es obligatoria para abrir prácticas. La terminal
  no pide texto; la API admite la nota ausente o vacía en los tres modos y guarda
  una cadena vacía, sin inventar una justificación. El límite de 1000 caracteres
  para notas voluntarias y la confirmación explícita de saldo virtual permanecen.
- Una terminal con gráfico Lightweight Charts, herramientas dentro de la vista,
  indicadores por plan, duración 1/2/5/15/60 minutos o cierre manual, cuenta atrás
  y P&L virtual estimado antes de comisión de cierre.
- Menú inferior con «Operar demo» central destacado y espacio inferior reservado;
  controles compactos; inicio reducido a saldo, siguiente acción, novedades
  manuales y aprendizaje. Promociones propias identificadas, sin carrusel automático.
- Onboarding de tres composiciones con alturas consistentes, logo centrado y CTA
  estable. Interacciones accesibles y movimiento reducido conservados.
- Plan visible en cabecera e inicio. Free/Explore siempre incluido: 5 simulaciones
  al día (UTC), 1 análisis IA al día, 7 días de historial visible, 1 alerta, SMA20
  y volumen. No se borra historial ni se bloquea el cierre por agotar el cupo.
  SL/TP siguen disponibles gratis. Precios Plus/Pro sin cambios.
- Checkout de un clic a Wompi y facturación autenticada. Recurrencia/prueba con
  tarjeta siguen pendientes; ver WOMPI-READINESS.md.

## Límites de la entrega

Verificación local: 384 pruebas unitarias, 19 escenarios de integridad de saldo
y liquidación en SQLite desechable, build de producción y recorrido aislado
Chromium/WebKit a 320/390/430 px. Se verificaron foco, gestos, CTA estable,
herramientas del gráfico, offline/pausa, cuenta atrás, creación/cierre demo,
carreras de snapshots/RSC, idempotencia y redirección de pago de un clic.
La comprobación pública de Binance obtuvo 121 observaciones por cada par.
También se comprobó en Chromium y WebKit una apertura y un cierre virtuales
con datos reales de Binance, bloqueo de símbolos sintéticos antes del débito
y OHLC auténtico en la vista de velas predeterminada. Estos ensayos no movieron
dinero ni activaron suscripciones reales.

Datos reales solo para BTC/USDT, ETH/USDT y SOL/USDT; demás aperturas bloqueadas
en producción. No hay licencia conectada para acciones/ETFs/FX. Ver MARKET_DATA.md.
La PWA sigue sujeta a los gestos reservados por iOS; una app web no puede garantizar
la sustitución de todos los gestos del sistema. WebKit de escritorio no equivale
a una prueba física de un iPhone instalado.

## Dependencias

Lightweight Charts fijado en 5.2.0, atribución visible. Auditoría npm de producción
detectó siete incidencias high en dependencias existentes/transitivas (Next,
PostCSS, Sharp, Prisma/config, deepmerge-ts y nanoid), ninguna en la nueva biblioteca.
La propuesta automática implicaba actualizar Next a una versión mayor; no se
ejecutó `audit fix --force`. Requiere un trabajo separado de actualización y
evaluación de exposición; esta revisión UX no certifica la seguridad del producto.
