# Guía de administración

## Acceso

`/admin`, disponible para cualquier rol con el permiso `admin:access`. Los estudiantes son
redirigidos al panel.

## Roles y permisos

| Rol | Puede |
|---|---|
| **Estudiante** | Nada en administración |
| **Instructor** | Leer y escribir contenido; ver analítica |
| **Editor de contenido** | Lo anterior, más publicar |
| **Soporte** | Ver usuarios, suscripciones y pagos; gestionar tickets; auditar simulaciones; reiniciar saldos |
| **Gestor de publicidad** | Gestionar inventario, campañas y facturación publicitaria |
| **Administración financiera** | Suscripciones, pagos, reembolsos y facturación publicitaria |
| **Cumplimiento** | Documentos legales, consentimientos, aprobación de anuncios, revisión de IA, auditoría |
| **Administración general** | Todos los permisos |

Los permisos se declaran en `src/lib/rbac.ts` con forma `recurso:acción`. No hay herencia implícita:
si un rol necesita un permiso, se escribe en su lista.

Para cambiar el rol de un usuario, hoy hay que hacerlo en la base de datos
(`npm run db:studio` → tabla `User` → campo `role`). La interfaz para gestionarlo desde el panel es
uno de los puntos pendientes del checklist de lanzamiento.

## Las doce secciones

### Resumen

La primera cifra es la **métrica principal del producto**: activación, definida como el porcentaje
de usuarios que completa el onboarding, al menos una lección y al menos una simulación.

Deliberadamente, la rentabilidad virtual agregada de los estudiantes **no aparece**. No es un
indicador de éxito y mostrarla invitaría a optimizar por ella.

### Usuarios

Búsqueda por nombre o correo, filtros por plan y estado. Muestra saldo DEMO, número de simulaciones,
entradas de diario y análisis de IA, y última actividad.

El saldo se expresa en dólares virtuales y no se usa como indicador de calidad ni de riesgo.

### Suscripciones

MRR, ARR, suscriptores activos, churn y ARPU. Tabla de configuración de planes, suscripciones
recientes, pagos, cupones y **webhooks con error**.

Si aparecen webhooks con error, revísalos: significa que un evento de la pasarela no se aplicó. El
sistema es idempotente, así que reprocesarlos es seguro.

### Contenido

Estructura de la academia, recuentos de glosario, artículos y certificados. Señala automáticamente
los **cuestionarios con puntuación media baja** (por debajo del 60 % con al menos tres intentos):
suele indicar que la lección no explica bien el concepto que evalúa, no que los estudiantes no lo
entiendan.

### Auditoría de simulaciones

La sección más importante para un auditor.

- **Verificación de integridad del libro mayor** sobre una muestra de cuentas en cada carga.
  Cualquier divergencia entre el saldo almacenado y la suma de los asientos es un incidente grave.
- Versiones del motor en uso: útil al desplegar una versión nueva, para saber qué simulaciones se
  calcularon con cuál.
- Proveedores de precio utilizados.
- Últimas simulaciones con precio de entrada y salida, proveedor, latencia y versión del motor.

### Inteligencia artificial

Uso por tipo de análisis, motores utilizados, mayor consumo por usuario, coste del mes frente al
tope configurado, valoración de utilidad y **respuestas marcadas por los guardarraíles** con el
detalle de cada violación.

Vigila dos cosas: que el coste no se dispare y que las respuestas marcadas no aumenten de repente
—eso sugiere una regresión del prompt o un cambio de comportamiento del modelo.

Al alcanzar el 80 % del tope aparece un aviso. Al alcanzarlo, los análisis pasan al motor
determinístico local sin interrumpir el servicio.

### Proveedores de datos

Proveedor activo con su comprobación de salud, proveedores registrados con su latencia declarada y
su atribución obligatoria, y el catálogo de instrumentos por clase de activo.

Recuerda la política de atribución: nunca se oculta.

### Publicidad

Ingresos reconocidos, impresiones, viewability y campañas activas. Tabla de campañas con presupuesto
consumido, impresiones, clics y CTR. Impresiones por espacio, anunciantes con su estado de
aprobación y paquetes comerciales configurables.

Las **creatividades pendientes de revisión** aparecen destacadas arriba. Los anunciantes financieros
requieren revisión manual antes de activarse.

### Analítica del negocio

Las 32 métricas definidas en `packages/analytics`, agrupadas por categoría: adquisición, activación,
retención, ingresos, costes, educación, publicidad y calidad. Incluye retención D1, D7 y D30 por
cohorte.

### Cumplimiento

Documentos legales versionados con su fecha de entrada en vigor, consentimientos agregados por tipo
y recientes con detalle, países restringidos, expresiones prohibidas aplicadas y la declaración de
naturaleza del servicio.

### Soporte

Tickets ordenados por prioridad. Los avisos de posible fraude y los usuarios Premium entran con
prioridad alta.

### Registro de auditoría

Acciones administrativas que modifican datos, con autor, rol, entidad y diferencia entre estado
anterior y posterior. Inmutable.

## Operaciones habituales

### Reiniciar el saldo de un usuario

Desde soporte, con el permiso `simulations:reset-balance`. El reinicio **no borra historial**: añade
el asiento de corrección al libro mayor con su motivo y marca temporal.

Antes de hacerlo, conviene mirar por qué se agotó: casi siempre hay un patrón de tamaño de posición
detrás, y esa es la conversación educativa que merece la pena tener con el estudiante.

### Aprobar una creatividad publicitaria

1. Revisar el informe automático en `/admin/publicidad`.
2. Comprobar manualmente que no promete rentabilidad, no imita el producto y el destino es legítimo.
3. Si el anunciante es financiero, verificar su registro ante el supervisor correspondiente.
4. Cambiar `reviewStatus` a `APPROVED` y registrar quién revisó.

### Publicar una versión legal nueva

1. Editar `src/content/legal.ts` incrementando `version`.
2. Ejecutar la semilla: crea la versión nueva sin borrar la anterior.
3. Si el cambio es sustancial, comunicarlo con treinta días de antelación y exigir nueva aceptación.

### Cambiar de proveedor de datos

Ver [`MARKET_DATA.md`](./MARKET_DATA.md). Resumen: implementar la interfaz, registrarlo y cambiar
una variable de entorno.

### Investigar una disputa sobre una simulación

`GET /api/simulations/:id/audit` devuelve todo lo necesario: precio de entrada y salida con su
proveedor y marca temporal, latencia, niveles, contexto congelado con los indicadores que el
estudiante tenía en pantalla, versión del motor, traza de cálculo y asientos del libro mayor.

Como el motor es determinístico, el resultado puede recalcularse y verificarse. Si no coincide, es
un error del producto, no del estudiante.

## Qué vigilar cada semana

1. Divergencias en el libro mayor — incidente grave.
2. Respuestas de IA marcadas — calidad del modelo.
3. Coste de IA frente al tope.
4. Salud del proveedor de datos.
5. Webhooks con error.
6. Cuestionarios con puntuación media baja — calidad del contenido.
7. Tickets de categoría «fraude».
