# Hoja de ruta

## Fase 1 — Primera versión comercial · **entregada**

Todo lo que el pliego sitúa en la primera versión está construido y funcionando:

Landing · Registro · Onboarding · Saldo DEMO de USD 10.000 · Dashboard · Lista de seguimiento ·
Gráfico · Hipótesis alcista y bajista · Historial · Diario · Cursos · IA educativa · Free, Standard
y Premium · Suscripciones · Publicidad · Panel administrativo · Términos y advertencias · Analítica
· PWA

Además, adelantado de la segunda fase porque el motor ya lo soportaba sin coste adicional:
posiciones LONG y SHORT simuladas, stop loss, take profit, calendario económico, artículos
educativos, retos y estadísticas avanzadas.

## Fase 2 — Profundidad

Lo que queda de la segunda versión del pliego, en orden de valor:

### Portafolio DEMO completo

El modo existe y opera; falta la vista de composición: asignación porcentual, comparación con
benchmark, riesgo de concentración y evolución del conjunto. Es la herramienta que enseña
diversificación, y hoy solo se puede intuir desde el historial.

### Certificados verificables

El modelo tiene `verificationCode` y `verified`. Falta la página pública de verificación, la
generación en PDF y el disparador automático al completar una ruta con sus evaluaciones superadas.

### Backtesting

Básico en Standard, avanzado en Premium. El motor determinístico lo hace viable de forma poco
habitual: se puede recorrer el histórico y liquidar cada operación con el mismo código que usa la
terminal, así que los resultados del backtest y los de la simulación en vivo son directamente
comparables. La lección sobre las cuatro trampas del backtesting ya está escrita; la herramienta
debe hacerlas evidentes: validación fuera de muestra obligatoria y costes de transacción siempre
incluidos.

### Venta directa de publicidad

El servidor publicitario está completo. Falta la interfaz de autoservicio para anunciantes: crear
campaña, subir creatividad, ver métricas y descargar factura.

### Alertas activas

Se crean y se listan; falta el proceso que las evalúa y notifica. Depende de la infraestructura de
tareas programadas.

### Noticias de actualidad

Requiere licencia de contenido. La interfaz ya distingue `EDUCATIONAL` de `MARKET`.

## Fase 3 — Escala

### Aplicaciones móviles

La PWA es instalable y la experiencia móvil está resuelta. Para aplicaciones nativas, el paso previo
es extraer la API a `apps/api`: hoy las route handlers de Next.js sirven bien a un único consumidor,
pero con tres clientes conviene un backend independiente. La arquitectura ya lo permite porque toda
la lógica vive en `packages/` y `lib/`.

### Torneos privados y salones de clase

`Challenge` tiene `visibility: PRIVATE` y `minPlan`. Falta el modelo de grupo: un instructor que
crea un aula, invita estudiantes, asigna rutas y ve su progreso agregado. Es la vía natural hacia el
plan para instituciones.

### Comunidad

Requiere moderación real desde el primer día. En una plataforma financiera educativa, un foro sin
moderar es un canal de captación para estafas. No debería lanzarse sin equipo de moderación
asignado.

### Marketplace educativo

Estrictamente moderado. Mismo razonamiento: el riesgo reputacional de permitir vender formación no
verificada supera al ingreso, salvo con un proceso de verificación serio.

### Mentorías y laboratorios de estrategia

El diario y las estadísticas dan la materia prima: un mentor puede ver el proceso del estudiante,
no solo su resultado.

### Más proveedores de datos

La interfaz está lista. Conviene al menos dos activos con conmutación automática ante fallo.

### Expansión internacional

`Locale` está modelado y persistido; falta extraer las cadenas a catálogos de traducción. El orden
razonable es portugués (Brasil) primero por proximidad de mercado, inglés después.

---

## Deuda técnica conocida

Merece la pena decirla en voz alta.

**Edición de contenido desde el panel.** El CMS muestra la estructura y las métricas, pero editar
una lección requiere tocar `src/content/academy.ts` y volver a sembrar. Para un equipo editorial no
técnico hace falta el editor. La decisión de mantener el contenido en código fue deliberada —el
control de versiones registra los cambios editoriales— pero no escala más allá del equipo fundador.

**Gestión de roles.** Cambiar el rol de un usuario se hace en base de datos. Es la operación
administrativa más sensible y debería tener interfaz con auditoría.

**Limitación de frecuencia en base de datos.** Funciona con una instancia. Con varias, cada una
lleva su propio contador y el límite efectivo se multiplica. Redis lo resuelve reimplementando una
función.

**Actualización por intervalo en la terminal.** Quince segundos es aceptable para uso educativo,
pero un WebSocket daría una experiencia mejor y menos carga. El estado ya está centralizado, así que
el cambio es local.

**El calendario económico no contempla festivos.** La aproximación por sesión es suficiente para
enseñar horarios, pero un proveedor real de calendario los incluiría.

**Sin caché en las llamadas al proveedor de datos.** Con el motor determinístico no importa, porque
el cálculo es local. Con un proveedor real, la lista de seguimiento de muchos usuarios simultáneos
agotaría la cuota. Hace falta caché de corta duración antes de conectar uno.
