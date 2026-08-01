# Cumplimiento

> **Nota para asesoría jurídica.** Este documento describe cómo están implementados los controles de
> cumplimiento en el producto. Los textos legales son de referencia y deben revisarse en cada
> jurisdicción de destino antes de la explotación comercial.

## Naturaleza del servicio

TradingLab es una **plataforma educativa de análisis y simulación de mercados financieros**. Esa
descripción exacta se usa en comunicaciones legales, onboarding, pagos y pie de página, y vive en
una sola constante (`LEGAL_ENTITY_DESCRIPTOR`).

### Lo que no hace, y cómo se garantiza

| Declaración | Cómo está implementada |
|---|---|
| No es un broker regulado | Declarado en el registro, el onboarding, el pie de página y el centro legal |
| No recibe dinero para inversión | No existe ningún endpoint de depósito |
| No admite depósitos de trading | No existe ningún endpoint de depósito |
| No permite retirar utilidades | No existe ningún endpoint de retiro; el saldo es una unidad de cuenta pedagógica |
| No custodia fondos ni activos | No hay modelo de datos de custodia |
| No ejecuta órdenes reales | El motor es local y determinístico; no hay conexión de ejecución |
| No conecta con mercados para invertir | Los proveedores son de solo lectura de precios |
| No promete rentabilidad | Lista de expresiones prohibidas aplicada en producto, IA y publicidad |
| No garantiza resultados | Los guardarraíles bloquean toda afirmación de certeza |
| Todas las operaciones son virtuales | La píldora DEMO acompaña al saldo en toda la interfaz |
| Los precios son educativos | `DataProvenanceBadge` visible junto a cada precio |
| Los resultados no anticipan el futuro | Advertencia de riesgo en el pie de página y en el centro legal |
| La IA no es un asesor financiero | Aviso al pie de cada análisis; guardarraíles contra suplantación |

### Sobre el término «broker»

Se emplea solo en contextos comparativos o divulgativos, para explicar cómo funciona la
intermediación financiera. En ningún caso se afirma que TradingLab sea un broker autorizado. El
documento «Naturaleza del servicio» lo declara de forma expresa.

## Expresiones prohibidas

`FORBIDDEN_CLAIMS` en `packages/types/compliance.ts` enumera 19 expresiones bloqueadas en tres
puntos: textos de producto, respuestas de la IA y creatividades publicitarias.

Incluye: «ganancia segura», «señal garantizada», «rentabilidad asegurada», «dinero fácil»,
«hazte rico», «sin riesgo», «riesgo cero», «beneficio garantizado», «retorno garantizado»,
«gana siempre», «nunca pierdas», «duplica tu dinero», «100 % de aciertos», «método infalible»,
«inversión segura» y variantes.

## Conducta de la IA

Trece conductas prohibidas, inyectadas en el prompt de sistema y verificadas después sobre la
salida. Las principales: garantizar resultados, afirmar conocimiento del futuro, dar órdenes
imperativas de compra o venta, inventar precios, noticias o indicadores, presentar una probabilidad
como certeza, recomendar endeudarse o usar dinero de necesidades básicas, incentivar recuperar
pérdidas operando más, recomendar aumentar el riesgo tras perder, presentarse como asesor autorizado
y recomendar plataformas no verificadas.

**Verificación estructural.** El esquema obliga a incluir riesgos, condiciones de invalidación,
nivel de incertidumbre y evidencias en ambos sentidos. Una respuesta unilateral se bloquea.

**Verificación de fabricación.** Cada lectura de indicador citada se compara con los valores que el
backend entregó en el contexto, con tolerancia del 0,5 %. Una lectura que no coincide se marca.

**Degradación honesta.** Si la respuesta no supera los controles, se sirve el análisis
determinístico local **indicando siempre qué motor lo generó**. Nunca se presenta una salida de un
motor como si viniera de otro.

## Publicidad

### Etiquetado

Todo espacio comercial se identifica visiblemente como patrocinado. La etiqueta forma parte del
marcado del componente `AdSlot` y no se puede desactivar por configuración.

### Ubicaciones prohibidas

Ocho superficies donde no puede servirse publicidad, verificadas **dos veces**: en el servidor
(`selectAd`) y en el componente de renderizado (`AdSlot`, que se niega a montarse):

`terminal-chart` · `terminal-order-form` · `simulation-confirmation` · `risk-alert` ·
`stop-loss-editor` · `quiz` · `ai-analysis` · `checkout`

Es decir: sobre el gráfico, encima de los botones de simulación, dentro del formulario de una
operación, durante la confirmación, dentro de alertas de riesgo, mientras se define un stop loss,
dentro de cuestionarios, junto a los análisis de IA y en el proceso de pago.

### Anunciantes excluidos

`reviewCreative` rechaza automáticamente promesas de rentabilidad, garantías de resultado, venta de
señales de trading, esquemas piramidales o multinivel, destinos sin HTTPS y creatividades que imiten
botones o terminología del producto. Los anunciantes de categoría financiera requieren además
revisión manual de cumplimiento antes de activarse.

### Segmentación

Permitida por país, idioma, dispositivo, página, tema educativo, plan, mercado de interés, franja
horaria y campaña. **Prohibido** segmentar usando información financiera del usuario, sus resultados
de simulación, su diario o inferencias sobre su situación económica. El endpoint de selección solo
recibe los campos permitidos.

### Por plan

Premium no genera ni una sola solicitud de anuncio: la comprobación es lo primero que hace
`selectAd`. Standard recibe densidad reducida. Ningún plan recibe interstitials.

### Patrocinio educativo

Un patrocinador puede asociar su marca a una ruta mediante logotipo y mensaje institucional aprobado
editorialmente. **No puede intervenir en el contenido, las evaluaciones ni las recomendaciones.**
Restricción contractual y reflejada en la política publicitaria pública.

## Consentimientos

Tres consentimientos obligatorios en el registro, con casillas independientes y sin premarcar:

1. Mayoría de edad según la jurisdicción de residencia.
2. Términos y condiciones, y política de privacidad.
3. Comprensión de la naturaleza del servicio y lectura de la advertencia de riesgo.

Más uno opcional de comunicaciones comerciales.

Cada consentimiento se registra con el identificador del documento, su **versión concreta**, la
fecha, el agente de usuario y el hash de la IP. `/admin/cumplimiento` los muestra agregados y
recientes.

## Versionado legal

Siete documentos versionados en `LegalDocument`, con restricción de unicidad sobre `(slug,
version)`. Publicar una versión nueva no borra la anterior: ambas quedan consultables y los
consentimientos apuntan a la versión aceptada.

Los cambios sustanciales requieren nueva aceptación y se comunican con treinta días de antelación,
según los propios términos.

## Países restringidos

Configurables por variable de entorno `RESTRICTED_COUNTRIES` o por la tabla `RestrictedCountry`. La
comprobación ocurre **en el servidor**, en el endpoint de registro, no solo en el formulario.

## Protección de datos

- Minimización: solo se recogen los datos necesarios para prestar el servicio.
- La IP nunca se almacena en claro, solo un hash con sal.
- La analítica filtra claves potencialmente identificadoras antes de escribir.
- El contexto enviado al modelo de IA no incluye ningún dato personal.
- Portabilidad: `/api/me/export` devuelve todo en JSON estructurado.
- Derecho de supresión: borrado o anonimización en un máximo de treinta días, salvo obligación
  legal de conservación.

## Gamificación responsable

Ninguna recompensa depende del beneficio virtual. Las doce insignias y los siete retos miden uso de
stop loss, contención del riesgo, relación riesgo-beneficio, cobertura del diario, constancia,
ausencia de impulsividad, calidad del razonamiento y avance educativo.

No hay cajas de recompensa, giros, sorteos, confeti excesivo ni ninguna mecánica de azar. La
experiencia se otorga por acciones deterministas y conocidas de antemano.

Una prueba automatizada verifica que un perfil que gana mucho sin stop loss, sin diario y con
operaciones impulsivas obtiene una puntuación de disciplina **baja**.

## Reglas comerciales

- Cancelación en un paso desde el perfil, sin encuestas obligatorias ni necesidad de contactar con
  soporte.
- Aviso antes de cada renovación.
- Sin cargos ocultos ni patrones oscuros.
- Descuento anual visible en porcentaje junto al precio.
- Prueba de Premium de siete días, una vez por cuenta, sin promesas de resultados.
- El acceso se conserva hasta el final del periodo abonado tras cancelar.
- Cancelar no borra historial, diario, certificados ni insignias.

## Pendiente antes de operar comercialmente

1. Revisión jurídica de los siete documentos en cada jurisdicción de destino.
2. Alta de la información registral: razón social, domicilio e identificación fiscal.
3. Determinación de si la actividad requiere alguna comunicación o registro ante el supervisor
   financiero en cada mercado objetivo, incluso siendo puramente educativa.
4. Revisión del tratamiento de datos por parte del proveedor de IA y firma del encargo de
   tratamiento correspondiente.
5. Definición del procedimiento de atención a solicitudes de derechos y del plazo de respuesta.
6. Revisión de la política publicitaria por parte de asesoría, en particular sobre la publicidad de
   servicios financieros en cada jurisdicción.
