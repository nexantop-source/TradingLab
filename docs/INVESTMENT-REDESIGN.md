# TradingLab: diseño y alcance de inversión

Implementación local del 5 de septiembre de 2026. No desplegada automáticamente.

## Experiencia

Se aplicaron las instrucciones de `apple-design`, instalada desde el repositorio
emilkowalski/skills: jerarquía tipográfica, revelado progresivo, respuesta inmediata,
selectores con spring interrumpible y respeto a movimiento reducido. Se conserva
el logo 13A aprobado. No se copian marcas ni pantallas de Apple o IQ Option.

La navegación principal es Resumen, Explorar, Trading, Portafolio y Academia.
La portada permite probar una vista de mercado; el explorador ofrece búsqueda,
filtros, ordenación, favoritos y detalles con procedencia de datos. El terminal
alterna vista simple/avanzada. El portafolio utiliza las posiciones de la cuenta
demo y distingue saldo disponible, margen reservado y resultado no realizado.

El catálogo tiene 50 instrumentos, incluidos 15 ETFs, divisas, criptomonedas,
acciones, índices y materias primas. **No equivale a todos los activos existentes.**
Los nuevos instrumentos tienen series sintéticas educativas, no precios reales.

## Planes implementados

| Plan | Precio de referencia USD | Límites y propuesta |
| --- | --- | --- |
| Explore | Gratis | 20 simulaciones/día, 5 análisis IA/día, historial 30 días, 3 alertas, publicidad contextual |
| Plus | 14,99/mes o 149/año | Simulaciones sin límite fijo, 150 análisis IA/mes, historial 365 días, 25 alertas, sin anuncios |
| Pro | 29,99/mes o 299/año | Simulaciones sin límite fijo, 900 análisis IA/mes, historial 3650 días, 200 alertas, sin anuncios |
| Teams | Cotización | Consulta comercial; no existe todavía un producto de cobro ni administración de equipos |

Los permisos y precios de los tres planes activos se leen desde `plans.ts`.
Se conservan los IDs FREE/STANDARD/PREMIUM por compatibilidad con usuarios y
facturación. El selector anual muestra total anual y equivalente mensual. El
registro conserva el plan y la periodicidad elegidos. El checkout existente
determina el total final en COP; los importes USD no garantizan una tasa de cambio.

## Qué falta para inversión real

La aplicación sigue siendo educativa. No recibe capital de inversión, custodia
activos, ejecuta órdenes en un broker ni permite retiros de saldo virtual.
La integración de cobro de suscripciones no es un depósito para operar.

Una siguiente fase requiere definir jurisdicciones y modelo regulatorio con
asesoría especializada, seleccionar un intermediario habilitado y un proveedor
de datos con licencias apropiadas, integrar identidad y controles aplicables,
órdenes y conciliación, y validar seguridad y operación antes de habilitar dinero
real. No se promete rentabilidad ni se oculta el carácter demo mientras esto falte.

## Publicidad

AdSense está registrado en nexantop@gmail.com. La cuenta y el sitio no son lo
mismo: aún falta perfil de pagos y un dominio válido para revisión. Ver ADS.md
para IDs, consentimiento, CSP, slots y puertas de activación. Plus y Pro no
solicitan anuncios. La terminal de ejecución conserva su superficie sin anuncios.
