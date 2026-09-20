# TradingLab · Lanzamiento en Colombia

**Fecha:** 20 de septiembre de 2026. **Estado:** plan de lanzamiento y validación, con cambios locales de producto. **Punto de partida confirmado por el fundador:** cero usuarios registrados y cero clientes de pago. Presupuesto, equipo disponible, costos de datos y costo de adquisición todavía no confirmados. Las metas de este documento son hipótesis de trabajo, no proyecciones de demanda.

## 1. Decisión y resumen ejecutivo

Sí existe una hipótesis comercial defendible: personas en Colombia que quieren empezar a invertir podrían pagar por una experiencia que conecte formación, práctica y revisión. La aplicación ya reúne academia, simulación, diario e IA educativa. La principal incertidumbre es si esa combinación consigue que alguien vuelva y pague, frente a alternativas gratuitas.

Las tres apuestas iniciales son:

1. **Una primera experiencia de aprendizaje completa.** El visitante entiende un concepto, practica y escribe qué aprendió. Es más convincente que mostrar cientos de activos o una lista de características.
2. **Plus accesible, con una rutina que invite a volver.** USD 5,99 es la entrada; la razón de renovación debe ser continuar aprendiendo. Un precio bajo no reemplaza la retención.
3. **Pro con profundidad demostrable.** USD 19,99 requiere que la academia completa y la revisión de decisiones resulten valiosas. Informes semanales, exportación y comparación de estrategias son candidatos de desarrollo, no beneficios disponibles que debamos anunciar hoy.

**Objetivo de los primeros 90 días:** comprobar activación, primeras compras y primeras renovaciones con cohortes pequeñas. Aspiración de prueba: 100–300 registros, 30–90 usuarios que completen el ciclo inicial y 10–30 compradores. No se deben usar estas cifras para prometer ingresos ni contratar gastos fijos.

La expansión a otros países debe esperar a una señal de repetición: clientes que vuelven, renuevan y explican por qué lo hacen. No es necesario construir Teams, una app nativa nueva ni un catálogo mayor para conseguir esa señal.

## 2. Mercado, público y posicionamiento

**Propuesta:** “Antes de invertir, aprende a decidir.”

**Explicación:** “¿Quieres poner tu dinero a trabajar? Empieza por entender cómo funcionan los mercados. Aprende, practica con saldo virtual y revisa tus decisiones con TradingLab.”

Esto recoge la aspiración de ganar dinero mediante inversiones, pero vende una capacidad que el producto sí puede entregar: comprender y practicar. Aprender no asegura beneficios. La [guía del inversionista de la Superfinanciera](https://www.superfinanciera.gov.co/publicaciones/11246/guas-informativas-11246/) subraya la relación entre objetivos, horizonte y riesgo; es una base educativa más sólida que asociar el curso con una rentabilidad futura.

**Público inicial propuesto:** adultos de 23–40 años residentes en Colombia, con ingresos propios y curiosidad por invertir, que consumen contenido financiero pero no tienen una rutina para aprender. Rango y perfil son hipótesis para entrevistas, no segmentaciones de demanda demostrada. Empezar por personas alcanzables mediante redes del fundador, comunidades educativas y contenido, sin excluir por ciudad ni asumir que todos pueden pagar.

**Problema expresado:** “Quiero invertir, pero no sé por dónde empezar.” **Problema que debemos comprobar:** falta de estructura, dificultad para entender el riesgo y desconexión entre mirar contenido y tomar una decisión razonada.

**No priorizar en adquisición:** quien necesita ingresos urgentes, busca señales, quiere recuperar pérdidas o espera retirar el saldo DEMO. Esas expectativas producirían frustración y mala retención.

### Alternativas reales

| Alternativa | Qué ofrece | Implicación para TradingLab |
|---|---|---|
| [Educación de la Superfinanciera](https://www.superfinanciera.gov.co/educacionSFC/) | Formación financiera pública | Cobrar solo por información introductoria es difícil de defender. |
| [TradingView Paper Trading](https://www.tradingview.com/support/solutions/43000516466-paper-trading-main-functionality/) | Simulador gratuito para varios mercados | “Simular” por sí solo tampoco es una ventaja suficiente. |
| [trii](https://www.trii.co/) | Acceso a inversiones reales | Puede ser una alternativa para quien ya quiere invertir. No debemos presentar TradingLab como intermediario equivalente. |
| [trii pro](https://www.trii.co/faq) | Membresía; la FAQ consultada publica COP 27.900 mensuales | Ancla de precio local, con funciones y modelo distintos. Revalidar la tarifa antes de usarla en campañas. |
| [tyba](https://tyba.com.co/como-funciona/) | Recorrido hacia inversión real y simulación de escenarios | Refuerza la necesidad de explicar qué resultado educativo entregamos. |
| Videos y contenido social | Explicaciones fáciles de consumir | La oportunidad es ayudar a aplicar y revisar, no competir en cantidad de videos. |

El [Reporte de Inclusión Financiera 2025](https://www.bancadelasoportunidades.gov.co/es/node/1263) es contexto sobre acceso financiero. Tener una cuenta bancaria no demuestra intención de comprar formación. No convertir ese universo en un mercado pagador ficticio.

### Entrevistas antes de escalar

Realizar 15 entrevistas: cinco principiantes, cinco personas que han intentado invertir y cinco que consumen formación pero no actúan. Preguntar por el último intento real, herramientas usadas, gastos previos, obstáculos y motivo para volver una semana después. Enseñar la aplicación después de escuchar. Pedir que completen una práctica; medir conducta, no solo “¿te gusta?”. Registrar hallazgos sin datos financieros privados innecesarios.

## 3. Estado actual y brechas

La revisión se basa en código local, navegación de la interfaz y una consulta anónima al despliegue. No se ha auditado una cuenta de analítica con usuarios reales, ni derechos comerciales de los proveedores de datos.

| Área | Evidencia | Acción |
|---|---|---|
| Mercado | Cero usuarios, confirmado por el fundador | Validar problema y disposición a pagar. |
| Oferta | Tres planes; precios y límites ajustados localmente | Medir el uso antes de aumentar beneficios. |
| Formación | Academia segmentada y certificados definidos en el producto | Revisar calidad y completar una ruta de principio a fin con usuarios. |
| Acceso | Login y registro funcionales, antes con país inicial España y formulario largo | Rediseño local, Colombia por defecto y registro en dos pasos. |
| Datos | 334 identificadores consultados en producción | Publicar fuente y antigüedad; no prometer tiempo real universal. |
| Cobro | Integración Wompi y conversión USD→COP mediante TRM en servidor | Mantener Wompi y comprobar importes antes de lanzamiento. |
| Renovación | La compra pública se describe como acceso por periodo sin renovación automática | Medir recompra real; no suponer cobros recurrentes. |
| Adquisición | Sin canal ni CAC comprobados | Empezar con contenido y pruebas pequeñas. |
| Retención | Sin cohortes | Crear una rutina semanal y observar uso. |
| Pro | Diferenciación actual concentrada en academia, cuotas e historial | Desarrollar profundidad solo a partir de problemas observados. |
| Soporte | Centro de ayuda/contacto | Priorizar recuperación de acceso antes de escalar; no inventar un enlace de recuperación sin flujo seguro. |
| Confianza | Explicación del carácter educativo y de los saldos virtuales | Unificar esa explicación en landing, registro y checkout. |

No asigno una puntuación numérica de madurez: sin usuarios y sin revisar todos los flujos autenticados, dar un 4/5 implicaría evidencia inexistente.

## 4. Adquisición y mensajes para Colombia

### Mensajes listos para probar

**A. Aspiración:** “¿Quieres empezar a invertir? Primero entiende qué estás haciendo. Aprende y practica con dinero virtual en TradingLab.”

**B. Decisión:** “Antes de elegir una acción, aprende a hacer las preguntas correctas. Empieza gratis con TradingLab.”

**C. Práctica:** “Una cosa es ver un video sobre inversión. Otra es poner a prueba lo que entendiste. Aprende, practica y revisa tu proceso.”

**D. Riesgo:** “Antes de pensar cuánto podrías ganar, entiende cuánto podrías perder. Practica tus decisiones con saldo virtual.”

**Texto principal de la página:** “Antes de invertir, aprende a decidir.” **CTA:** “Empieza gratis.” **Apoyo:** “Cuenta educativa · Sin tarjeta · Práctica con saldo virtual.” La mención del saldo virtual va como explicación, no como premio económico.

No afirmar “aprende a ganar”, “conviértete en rentable”, “recupera tu inversión” ni mostrar resultados DEMO como prueba de ganancias de clientes. No usar testimonios, alumnos, descuentos o cupos inexistentes.

### Primer mes de contenido

Publicar tres piezas cortas y un carrusel por semana; adaptar un mismo aprendizaje entre Instagram, TikTok y YouTube Shorts. La cadencia depende de la disponibilidad del fundador; si solo puede sostener dos piezas, priorizar consistencia y demostraciones útiles.

| Semana | Tema | Demostración dentro de la app | CTA |
|---|---|---|---|
| 1 | Objetivo, plazo y riesgo | Elegir una hipótesis y explicar por qué | Completa tu primera práctica. |
| 2 | Qué representa una acción y un ETF | Observar dos instrumentos sin recomendar comprarlos | Aprende a distinguirlos. |
| 3 | Diferencia entre dato reciente, diferido y cierre | Mostrar fuente y fecha en el explorador | Revisa la información antes de decidir. |
| 4 | Una buena decisión puede terminar en pérdida | Revisar una práctica y escribir una conclusión | Empieza tu diario. |

**Guion breve de ejemplo:** “Quieres invertir, pero antes de escoger una acción hay tres preguntas: ¿para qué inviertes?, ¿por cuánto tiempo?, ¿qué pérdida podrías asumir? En TradingLab puedes aprender los conceptos y practicar con saldo virtual. Empieza gratis. Las prácticas no garantizan resultados reales.”

### Canales y orden

1. Red cercana y comunidades educativas donde el fundador tenga permiso para participar: conseguir observaciones y entrevistas, no enviar mensajes masivos.
2. Contenido del fundador con captura real del producto: confianza y demostración.
3. Colaboraciones con docentes o creadores pequeños: una práctica guiada, compensación transparente y sin atribuirles afiliación hasta pactarla.
4. Búsqueda orgánica: cinco artículos útiles y demostrables —cómo aprender a invertir desde cero, qué es una cuenta DEMO, diferencias entre ETF y acción, diario de inversión y riesgo— con ejemplos colombianos.
5. Publicidad pagada solo cuando registro, primera práctica y atribución estén comprobados. Primero un canal; Meta puede ser una hipótesis, no una elección validada por datos propios.

No automatizar contactos, publicar anuncios ni gastar presupuesto con este documento. Es un plan ejecutable; el gasto y los envíos siguen pendientes de una decisión específica del fundador.

## 5. Activación y UX/UI

**Evento de valor inicial:** dentro de los siete días del registro, completar una lección, una práctica y una entrada de diario. La simple apertura de una cuenta no cuenta como activación.

Recorrido recomendado: mensaje claro → registro → elegir objetivo de aprendizaje → lección breve → práctica guiada → reflexión → siguiente paso. El primer contacto no debería exigir interpretar un terminal lleno de indicadores.

### Cambios locales aplicados

- Login y registro con una composición común, identidad visible y texto ligado al aprendizaje.
- Columna educativa en escritorio; prioridad al formulario en móvil, sin ilustración que empuje los campos.
- Registro en dos pasos: datos y consentimientos. Colombia preseleccionada, editable.
- Validación local con los mismos esquemas del servidor; foco en el campo que necesita corrección.
- Conservación de datos al volver atrás, contraseña visible/oculta y prevención de envíos duplicados mientras se procesa.
- Selección de Plus/Pro y periodicidad preservada entre login y registro.
- Mensaje de landing orientado a aprender antes de invertir.
- La caída de una muestra de mercado ya no debe impedir mostrar toda la landing.
- Fuente y estado de la muestra más claros en el explorador, con actualización manual.

### Siguientes mejoras, ordenadas

| Prioridad | Cambio | Cómo decidir si funciona |
|---|---|---|
| P0 antes de publicidad | Observar cinco registros móviles reales | Al menos cuatro completan sin ayuda; registrar tiempos y errores. |
| P0 antes de publicidad | Completar el flujo de primer aprendizaje y practicar con mercado abierto/cerrado | El usuario identifica saldo virtual y entiende qué hacer después. |
| P1 | Recuperación segura de contraseña | Solicitud genérica, token de un solo uso con expiración y correo operativo. |
| P1 | Reducir o posponer preguntas del onboarding que no cambian el primer ejercicio | Medir abandono por paso frente a primera práctica completada. |
| P1 | Mostrar claramente el importe final COP y duración del acceso | Nadie interpreta el pago como capital para invertir. |
| P1 | Resumen semanal de aprendizaje | Aumenta el retorno y la segunda práctica, sin enviar mensajes sin consentimiento. |
| P2 | Informes y exportación Pro | Usuarios de Pro los consultan y explican su valor antes de expandirlos. |

No se implementaron en este cambio informes semanales, nuevas rutas, múltiples portafolios ni recuperación de contraseña. No deben figurar como beneficios disponibles.

## 6. Retención y renovación

El producto debe responder cada semana: “¿Qué aprendí y qué me conviene practicar ahora?”. Proponer una rutina de tres momentos: concepto, ejercicio y revisión. Medir cumplimiento, sin premiar operar más ni asumir más riesgo.

Comunicación propuesta, únicamente con el consentimiento y la infraestructura adecuados:

- Día 0: primer paso y explicación del saldo virtual.
- Día 2: retomar la lección si quedó incompleta.
- Día 7: progreso real y un ejercicio sugerido.
- Antes del vencimiento: fecha exacta, acceso que termina y cómo renovar por Wompi.
- Tras vencer: explicar que vuelve a Explore y cómo se conservan los datos conforme a la política vigente.

No enviar campañas desde este trabajo. Segmentar por conducta: no insistir con la primera práctica a quien ya la completó. Medir clics, regreso y aprendizaje; no usar aperturas de correo como única señal.

Como Wompi se utiliza aquí para compras por periodo sin renovación automática en la oferta pública, usar **tasa de recompra** además de “churn”. Una membresía activa no garantiza la siguiente mensualidad.

## 7. Recomendación y alianzas

Pedir recomendaciones solo después de una experiencia útil, por ejemplo al terminar una ruta. Inicialmente basta un enlace con atribución de campaña. Evitar construir un programa complejo de referidos antes de comprobar retención.

Aliados a explorar: docentes de finanzas, clubes universitarios para mayores de edad y comunidades de formación. Ofrecer una sesión de uso del simulador y recoger preguntas. No ofrecer señales ni compensaciones ligadas al rendimiento de inversiones. Teams queda como hipótesis posterior; hoy no existe un producto completo de gestión de alumnos.

## 8. Oferta, costos y posibilidad de generar ingresos

### Paquetes de lanzamiento implementados localmente

| | Explore | Plus | Pro |
|---|---|---|---|
| Precio mensual de referencia | Gratis | USD 5,99 | USD 19,99 |
| Precio anual de referencia | Gratis | USD 59,99 | USD 199,99 |
| Simulaciones diarias | 2 | 20 | Sin límite fijo, uso razonable |
| IA por mes | 3 | 60 | 300 |
| Historial consultable | 7 días | 1 año | 10 años |
| Formación | Básica actual | Intermedia | Completa |
| Indicadores | Básicos | Avanzados | Avanzados |
| Publicidad | Espacios identificados, cuando el proveedor esté habilitado | Sin publicidad | Sin publicidad |

Las estadísticas y el diario ya existentes se mantienen. No se redujo la academia gratuita a un único módulo: requiere una decisión pedagógica e implementación por separado. El precio se cobra en COP con el importe que calcula el servidor; el precio USD es referencia. Los anuales representan aproximadamente 16,5 % de ahorro frente a doce pagos mensuales.

### Modelo económico ilustrativo

La [tarifa publicada de Wompi](https://wompi.com/es/co/planes-tarifas/) para Plan Avanzado es 2,65 % + COP 700 + IVA por transacción exitosa; la [documentación](https://docs.wompi.co/docs/colombia/jumpseller-plugin/) especifica 19 % de IVA sobre esa comisión. Confirmar tarifa contractual y tratamiento tributario propio antes de presupuestar.

Para hacer comparables las cifras siguientes se utiliza **COP 4.000 por USD como supuesto aritmético**, no TRM actual ni precio de checkout. Supuestos adicionales, no mediciones: IA mensual de USD 0,50 por cliente Plus y USD 2 por Pro; infraestructura variable de USD 0,40 y USD 0,80. No incluyen soporte humano, adquisición, usuarios gratuitos, salarios, devoluciones, impuestos de la venta ni contratos de datos.

Comisión ilustrativa USD = `(precio USD × 0,0265 + 700/4000) × 1,19`.

| Por cliente/mes | Plus | Pro |
|---|---:|---:|
| Ingreso bruto | 5,99 | 19,99 |
| Wompi estimado bajo los supuestos | 0,40 | 0,84 |
| IA presupuestada | 0,50 | 2,00 |
| Infraestructura variable presupuestada | 0,40 | 0,80 |
| Contribución antes de costos omitidos | **4,69** | **16,35** |

Los cupos máximos de IA deben probarse contra tokens y costos reales: un presupuesto promedio no demuestra que el uso intensivo de 60/300 consultas sea rentable. Medir p50, p95 y costo máximo por usuario, no solo el promedio. No añadir IA ilimitada.

Suponiendo mezcla **80 % Plus y 20 % Pro**, solo pagos mensuales, el ingreso promedio es USD 8,79 y la contribución ilustrativa es aproximadamente USD 7,02:

| Clientes activos que compraron el mes | Ingreso bruto USD | Contribución ilustrativa USD |
|---:|---:|---:|
| 30 | 263,70 | 210,74 |
| 100 | 879,00 | 702,46 |
| 300 | 2.637,00 | 2.107,37 |
| 1.000 | 8.790,00 | 7.024,56 |

Estos resultados no son utilidad ni proyección comercial. El resultado real puede ser negativo al incluir desarrollo, publicidad, soporte y datos. Con costos fijos de USD 500, se requieren alrededor de 72 clientes bajo esos supuestos, **antes** de los costos omitidos. Si un proveedor comercial de datos o soporte aumenta el gasto fijo, el umbral cambia.

**CAC de prueba:** intentar recuperar adquisición en un máximo de tres meses de contribución observada. Con este ejemplo: aproximadamente USD 14 para Plus, USD 49 para Pro o USD 21 para la mezcla. Son techos experimentales, no permiso de gasto. No calcular LTV con una tasa de abandono inventada; esperar varias cohortes.

**Sensibilidad:** con conversión de registro a compra del 2 %, obtener 30 compradores requiere 1.500 registros; con 5 %, 600; con 10 %, 300. Ninguna tasa está demostrada. Con COP 1.000 por visita y 0,5 % de visitantes compradores, el CAC sería COP 200.000, demasiado alto para el ejemplo de recuperación de Plus. Esto explica por qué conviene empezar orgánicamente.

**Veredicto:** existe potencial de ingresos por membresías. No hay todavía evidencia para decir que hay un negocio rentable o que podemos escalar adquisición. La prueba es que usuarios ajenos al equipo paguen, vuelvan y recompren. La publicidad dentro del gratuito no se incluye como fuente material de ingresos en esta fase.

## 9. Plan de 90 días

Responsables propuestos: fundador (mercado, contenido y entrevistas), producto/desarrollo (fiabilidad y experiencia), soporte (fundador inicialmente). Si una misma persona lleva los tres papeles, reducir la cadencia, no simular un equipo mayor.

| Periodo | Trabajo | Métrica/entregable | Decisión al cerrar |
|---|---|---|---|
| Semanas 1–2 | Revisar cambios, datos y cobro; 15 entrevistas y 5 sesiones de usabilidad | Lista de problemas, primer flujo completo, errores y costos básicos | No abrir publicidad si hay bloqueos de registro, pago o precios. |
| Semanas 3–4 | Invitar una cohorte pequeña por canales permitidos; publicar primeras demostraciones | 20–30 participantes como meta de captación, tasa de activación y retorno | Corregir el mayor abandono antes de comprar tráfico. |
| Semanas 5–6 | Presentar Plus a usuarios activos y explicar Pro sin funciones futuras | Primeros compradores, razones de compra/rechazo | ¿Qué beneficio paga la gente? |
| Semanas 7–8 | Probar una campaña pequeña solo si hay activación y atribución | CAC por cliente, conversión por etapa, consumo IA | Pausar si el costo supera la contribución recuperable. |
| Semanas 9–10 | Observar vencimientos y recompras; entregar mejora de mayor demanda | Retorno semanal, renovación por cohorte, soporte | Diferenciar rechazo del precio y falta de uso. |
| Semanas 11–12 | Revisar cohortes y estados de resultados | Decisión documentada de continuar, ajustar o frenar | Aumentar presupuesto solo con evidencia. |

**Umbrales internos propuestos para aprender:** activación ≥30 % de registros, retorno en segunda semana ≥25 % de activados y al menos 10 compras no incentivadas. No son benchmarks del mercado. Con menos de 30 usuarios o 10 compradores, informar fracciones (3/10) y entrevistas; no declarar un experimento estadísticamente ganador.

### Presupuesto sin asumir fondos disponibles

- **Sin pauta:** contenido del fundador, entrevistas y distribución autorizada. Registrar el costo del tiempo; orgánico no significa gratis.
- **Piloto opcional de COP 300.000–600.000 en total:** solo tras validar el flujo y aprobar el gasto; un canal, dos mensajes, misma audiencia, revisión por embudo. Si no hay volumen para una comparación útil, usarlo para aprender mensajes y no inferir superioridad estadística.
- **Escala:** aumento gradual basado en recompra y margen. No fijar ahora una inversión mensual permanente ni contratos de agencia.

## 10. Horizonte de doce meses

- **Trimestre 1:** evidencia de primera compra y primeros retornos. Prioridad en Colombia y un segmento.
- **Trimestre 2:** profundizar en el caso que retiene; informe Pro y recuperación de acceso si son los principales obstáculos. Evaluar contratos de datos con números de uso reales.
- **Trimestre 3:** probar una alianza educativa repetible. Teams solo si hay demanda pagadora y capacidad de soporte.
- **Trimestre 4:** evaluar expansión regional o inversión externa con cohortes, margen y adquisición documentados. Sin esos datos, continuar la validación en Colombia.

Si llega capital, destinarlo primero a fiabilidad, producto educativo y datos con derechos claros; después a adquisición. Captar inversión no resuelve por sí mismo un problema de retención.

## 11. Operación y medición

El repositorio contiene catálogo de eventos y tracking del lado servidor. Eso no prueba que exista un tablero operativo ni atribución completa. Revisar antes de lanzar.

| Etapa | Señal | Herramienta actual/propuesta | Responsable |
|---|---|---|---|
| Adquisición | Origen, campaña, visita y registro | UTM + analítica propia; validar persistencia | Fundador/producto |
| Activación | Lección, simulación y diario en siete días | Eventos existentes y consulta por cohorte | Producto |
| Retención | Aprendizaje semanal y retorno | Eventos de uso, sin depender de visitas vacías | Producto |
| Recomendación | Registros activados por enlace | Atribución ligera; pendiente | Fundador |
| Ingresos | Pago aprobado, acceso, vencimiento, recompra | Wompi y libro de pagos; no contar intentos | Producto |
| Costos | IA y datos por plan, fallos y soporte | Logs/registro de consumo + facturas | Fundador |

Usar skills de pricing, marketing y diseño como apoyo al trabajo; no agregar herramientas de pago ni conectores que todavía no aporten decisiones. Una tabla semanal puede ser suficiente para la primera cohorte.

## 12. Banco de experimentos priorizado

| Experimento | Etapa | Momento | Hipótesis |
|---|---|---|---|
| Mensaje “antes de invertir” frente a demostración de primera práctica | Adquisición | Ahora | Una promesa concreta aumenta registros útiles. |
| Registro en dos pasos | Activación | Aplicado localmente; validar | Menor carga visual sin perder consentimientos. |
| Primera lección seguida de un ejercicio | Activación | Ahora | La estructura supera empezar en un terminal libre. |
| Revisión semanal de diario | Retención/ingresos | Después de observar uso | Pro se paga por la revisión, no solo por el cupo. |
| Historia del fundador mostrando dudas reales | Adquisición | Ahora | Genera confianza sin testimonios inventados. |
| Colaboración con docente | Adquisición/recomendación | Segundo mes | El contexto educativo trae usuarios que practican. |
| Anual | Ingresos | Disponible; no forzar | Algunos usuarios prefieren continuidad y ahorro. |
| Referidos con atribución | Recomendación | Tras activación repetida | Usuarios satisfechos recomiendan espontáneamente. |
| Teams, afiliación masiva y agencias | Varios | Posponer | Complejidad prematura con cero usuarios. |
| Catálogo mayor, noticias automáticas e IA ilimitada | Producto | Posponer | Aumentan costo sin evidencia de valor. |

La selección es deliberada: no tiene sentido asignar 139 tácticas a un producto sin una primera cohorte. La prioridad es aprender con un número manejable de experimentos.

## 13. Criterios de decisión, datos de mercado y siguientes pasos

**Métrica principal:** usuarios semanales que completan al menos un ciclo de lección/práctica/reflexión. Complementar con compras y recompra, no sustituirlos.

Definiciones: activación = registros que completan el ciclo en siete días / registros con siete días de observación; conversión = compradores únicos / cohorte de registros madura; recompra = miembros con un pago posterior / miembros cuyo periodo venció y tuvieron una ventana suficiente para renovar. CAC incluye gasto atribuible; margen incluye costos de atender gratis y pago, sin mezclar facturación anual con ingreso mensual.

### Auditoría de datos

Consulta anónima de los **334 identificadores** del catálogo contra producción el 20/09/2026, a las 16:24 de Colombia. Existen alias de instrumentos; no representa 334 subyacentes únicos. Evidencia completa: `market-audit.json` y resumen en `AUDITORIA-Y-VALIDACION.md`.

- 60 muestras con marca REALTIME y antigüedad de hasta 30 segundos.
- 265 referencias de mercados que la fuente declara cerrados.
- 8 muestras antiguas o marcadas STALE.
- 1 instrumento sin cotización: CHL30.

No todos los activos están en tiempo real. La revisión de domingo tampoco permite certificar el comportamiento intradía de bolsas cerradas. Yahoo documenta [retrasos por bolsa y proveedor](https://help.yahoo.com/kb/SLN2310.html). El respaldo de divisas del proyecto es diario. Debemos mostrar estas diferencias, no ocultarlas con una etiqueta global “en vivo”.

Para certificar cobertura: repetir la auditoría en sesiones abiertas de las bolsas correspondientes, observar varias muestras por instrumento, revisar timestamp/frecuencia/caché y comparar cotización e histórico. Confirmar por escrito derechos de redistribución y uso comercial. Un endpoint público que responde no equivale a una licencia de datos.

### Decisiones abiertas

1. Presupuesto y horas del fundador disponibles para 90 días.
2. Definir una ruta introductoria colombiana: objetivos, riesgo, plazo, diversificación y práctica. El contenido debe distinguir inversión de largo plazo y trading activo.
3. Revisar costos máximos de IA y contratos de datos antes de comprometer precios a escala.
4. Validar primera compra y expiración en el entorno de pruebas de Wompi; no realizar cobros reales para una prueba de interfaz.
5. Desplegar los cambios tras revisión del resultado local. Esta entrega no publica campañas ni despliega producción.

**Criterio para seguir:** clientes reales completan prácticas, encuentran valor, pagan y regresan con costos sostenibles. **Criterio para ajustar:** tráfico sin activación, pagos sin uso o uso sin recompra. **Criterio para frenar pauta:** CAC que no se recupera, datos poco fiables o fallos de acceso/pago.

## Decisión posterior de datos de mercado

Se adopta Yahoo Finance como fuente principal de cotizaciones e históricos por solicitud del usuario. Los instrumentos sin cobertura quedan no disponibles; se bloquean nuevas operaciones con mercado cerrado. Ver la actualización y evidencia en [AUDITORIA-Y-VALIDACION.md](./AUDITORIA-Y-VALIDACION.md). Las cifras de la primera auditoría de producción corresponden al proveedor anterior. No anunciar «todos los activos en tiempo real»: comunicar datos reales con procedencia, fecha y posible retraso.
