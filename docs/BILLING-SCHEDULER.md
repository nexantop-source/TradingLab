# Programador de cobros

Producción verificada el 20 de septiembre de 2026 (Bogotá).

El trabajo canónico es **tradinglab-charge-due**, en nexant-87204 / us-east4. Está habilitado y llama a POST /api/billing/charge-due al minuto 5 de cada hora (UTC). La última ejecución observada terminó sin error. La cabecera de autorización coincide con el secreto de la revisión desplegada.

El antiguo **tradinglab-cobros-vencidos**, diario a las 13:20 de Bogotá, estaba habilitado simultáneamente. Se pausó de forma reversible para evitar invocaciones duplicadas. No volver a habilitarlo mientras exista el trabajo canónico.

Ambos scripts de configuración ahora apuntan a tradinglab-charge-due:

- node scripts/billing-scheduler.mjs: inspección y propuesta, sin cambios.
- node scripts/billing-scheduler.mjs --aplicar: actualiza el trabajo canónico.
- node scripts/setup-schedulers.mjs --apply: configura cobros y recordatorios.
- node scripts/qa-wompi-production.mjs: comprueba configuración, unicidad del programador y admisión del webhook; no crea transacciones.

La opción --ejecutar de billing-scheduler.mjs inicia cobros reales de suscripciones vencidas y no debe utilizarse como prueba inocua de salud.

El endpoint exige PUSH_DISPATCH_SECRET, reclama cada cobro antes de enviarlo y espera conciliación ante una respuesta de red incierta. La periodicidad del programador no adelanta la fecha aceptada en el mandato. Una ejecución exitosa del trabajo no demuestra por sí sola que un banco haya liquidado un pago.
