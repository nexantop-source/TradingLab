# Manual de marca TradingLab

**Versión:** 2.0
**Fecha:** 2026-08-29
**Fuente de verdad técnica:** `tokens/brand-tokens.json`

## 1. Esencia

TradingLab es un laboratorio educativo para aprender a observar mercados, formular hipótesis y revisar decisiones con saldo DEMO sin valor monetario. No es un bróker, no ejecuta operaciones reales y no presta asesoramiento financiero.

### Idea rectora

**Criterio antes que certeza.**

La certeza es una promesa peligrosa en mercados. El criterio, en cambio, se puede entrenar: separar hechos de interpretaciones, registrar una hipótesis, definir qué la invalidaría y revisar el proceso después.

### Promesa de experiencia

«Te damos un entorno claro para practicar cómo piensas antes de arriesgar capital real.»

### Pilares

1. **Aprendizaje progresivo:** primero contexto, luego práctica, después reflexión.
2. **Simulación honesta:** todo saldo DEMO se identifica de forma inequívoca.
3. **IA contextual y limitada:** ayuda a hacer mejores preguntas; no entrega señales u órdenes.
4. **Trazabilidad:** fuentes, supuestos y estado de la información deben ser visibles.
5. **Disciplina:** el proceso importa más que una operación aislada.

## 2. Personalidad y voz

TradingLab suena como un mentor sereno y preciso: curioso, directo, respetuoso y consciente de los límites. No usa miedo, euforia ni urgencia artificial.

### Sí decimos

- «Formula una hipótesis y define qué la invalidaría.»
- «Practica con saldo DEMO sin valor monetario.»
- «La IA resume contexto; tú tomas y revisas la decisión.»
- «Esta información puede estar incompleta o desactualizada.»
- «Explora una ruta» / «Abrir simulador» / «Revisar mi proceso».

### No decimos

- «Gana», «multiplica», «rentabilidad asegurada» o «sin riesgo».
- «Compra ahora», «vende ya», «señal infalible» o equivalentes.
- «La IA predice el mercado» o «nunca te equivocarás».
- Rankings o porcentajes de rendimiento sin metodología, periodo y fuente verificables.
- Escasez falsa, temporizadores o testimonios que insinúen resultados típicos.

### Fórmula editorial

**Contexto → acción educativa → límite.** Ejemplo: «Compara dos escenarios, registra qué dato cambiaría tu hipótesis y recuerda: es una simulación educativa, no una recomendación.»

## 3. Logotipo

El símbolo representa una decisión que se abre en dos escenarios equivalentes. El nodo central es la evidencia presente; los extremos son hipótesis que deben contrastarse. La composición es equilibrada a propósito: ninguna rama “sube” como promesa de rendimiento.

### Versiones

- **Principal:** símbolo, nombre y idea rectora; para portadas y presentaciones.
- **Horizontal:** símbolo y nombre; para navegación, cabeceras y patrocinios.
- **Símbolo:** para avatares y espacios compactos.
- **Monocromo positivo:** Deep Ink sobre fondos muy claros.
- **Monocromo negativo:** blanco sobre fondos oscuros.
- **Favicon:** símbolo simplificado; no sustituye al logo en piezas grandes.

### Retícula y área de reserva

La unidad **x** equivale al diámetro del nodo central del símbolo. Mantén como mínimo **4x** libres alrededor del logo principal u horizontal y **2x** alrededor del símbolo. Ningún texto, borde, imagen o sello debe entrar en esa reserva.

### Tamaño mínimo

- Logo horizontal digital: 128 px de ancho.
- Logo principal digital: 180 px de ancho.
- Símbolo digital: 24 px.
- Impresión: 35 mm horizontal; 8 mm símbolo.
- Por debajo de 32 px usa el favicon simplificado.

### Usos prohibidos

No estirar, inclinar, rotar, separar nodos, recolorear arbitrariamente, añadir sombras duras, contornos, degradados no aprobados o meter el logo dentro de otra forma. No convertir las ramas en velas, flechas, monedas o gráficos de rentabilidad. No usar la línea «Criterio antes que certeza» como garantía de resultados.

## 4. Color

| Token | Hex | Rol |
|---|---:|---|
| Deep Ink | `#1D1D1F` | Texto principal y superficies profundas |
| Paper | `#F5F5F7` | Fondo neutro de la plataforma |
| Surface | `#FFFFFF` | Tarjetas, paneles y contenido elevado |
| Decision Blue | `#0071E3` | Acción primaria, selección y foco |
| Lab Cyan | `#56B4FF` | Exploración, datos y estados informativos |
| Signal Lime | `#547B00` | Progreso educativo y acento puntual; nunca “ganancia” |
| Slate | `#6E6E73` | Texto secundario y metadatos |
| Success | `#16834B` | Operación completada o respuesta correcta |
| Risk | `#D70015` | Riesgo, error o pérdida DEMO |
| Warning | `#9A6700` | Datos incompletos o acción que requiere atención |

### Proporción orientativa

En una interfaz clara: 55% Surface, 30% Paper, 10% Deep Ink y 5% Decision Blue. Cyan y Lime son acentos raros. Success y Risk solo comunican estado; nunca pintan rendimiento como espectáculo.

### Contraste

El texto normal debe alcanzar WCAG 2.2 AA (4.5:1) y el texto grande o elementos de interfaz al menos 3:1. Combinaciones seguras: Deep Ink/Paper, Paper/Deep Ink, Paper/Decision Blue y Deep Ink/Signal Lime. Slate se usa sobre Paper únicamente en tamaños de 16 px o más. No colocar texto Paper sobre Lab Cyan ni Signal Lime sin una placa Deep Ink.

## 5. Tipografía

### Tipografía de sistema — interfaz y contenido

La interfaz prioriza `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text` cuando exista y utiliza Instrument Sans como respaldo distribuido. Se aplica a navegación, cuerpo, botones, formularios y titulares. Pesos 400–700.

### Display sans — titulares editoriales

Los titulares usan la misma familia de sistema en peso 600–700, mayor escala y tracking negativo. Se elimina la cursiva decorativa para mantener una voz más precisa y silenciosa.

### JetBrains Mono — evidencia

Para precios, fechas, instrumentos, estados, identificadores y datos DEMO. No usar en todo el producto: debe señalar información verificable.

### Escala digital

| Uso | Tamaño / línea | Familia |
|---|---|---|
| Display | `clamp(3rem, 7vw, 6.5rem)` / 0.94 | Instrument Sans 650 |
| H1 | `clamp(2.4rem, 5vw, 4.5rem)` / 1.0 | Instrument Sans 650 |
| H2 | `clamp(1.9rem, 3vw, 3rem)` / 1.06 | Instrument Sans 600 |
| H3 | 1.5rem / 1.2 | Instrument Sans 600 |
| Cuerpo grande | 1.125rem / 1.6 | Instrument Sans 400 |
| Cuerpo | 1rem / 1.6 | Instrument Sans 400 |
| Meta / dato | 0.8125rem / 1.4 | JetBrains Mono 500 |

## 6. Composición e interfaz

La interfaz se organiza como un cuaderno de laboratorio: preguntas amplias, evidencia legible y acciones bien delimitadas. El espacio no es vacío decorativo; debe revelar jerarquía.

- Retícula base de 8 px con subunidad de 4 px.
- Ancho de lectura: 62–72 caracteres.
- Radios: píldora para acciones, 17 px controles, 22 px tarjetas y 30 px contenedores editoriales.
- Sombras ambientales muy suaves; los bordes se reservan para controles, tablas y estados.
- Un CTA primario por bloque. Las acciones secundarias no compiten en color.
- Estados de carga reservan espacio para evitar saltos de layout.
- Nunca depender solo del color: incluir texto, icono o patrón.

## 7. Imagen, ilustración y datos

Preferir mapas de escenarios, bifurcaciones, anotaciones, capas de evidencia, cuadernos y diagramas de proceso. Fotografía, si se usa, debe mostrar estudio o reflexión, no lujo, carros, pantallas con dinero o gestos eufóricos.

Los gráficos de mercado se presentan como material de observación, con contexto temporal y etiquetas DEMO cuando aplique. Evitar velas verdes gigantes, cohetes, toros/osos, billetes, monedas y fondos de “trader cockpit”.

## 8. Movimiento

El movimiento explica estado, no crea urgencia. Duración estándar 180–260 ms, easing `cubic-bezier(.2,.8,.2,1)`. Los diagramas pueden revelar nodos por etapas; no deben simular precios en vivo si los datos no lo son. Respetar `prefers-reduced-motion` y eliminar desplazamientos no esenciales.

## 9. Accesibilidad

- Foco visible de 2 px en Decision Blue con halo Paper/Deep Ink según fondo.
- Objetivos táctiles mínimos de 44×44 px.
- Zoom al 200% sin pérdida de contenido u operación.
- Lenguaje simple, errores asociados al campo y navegación por teclado completa.
- Alt text describe la función, no «imagen de».
- Tablas y gráficos incluyen resumen textual y fuente/fecha.
- Animaciones, parpadeos y actualizaciones automáticas ofrecen pausa o alternativa.

## 10. IA responsable

Toda respuesta de IA debe identificar su alcance y permitir revisar contexto. Debe evitar órdenes, señales o lenguaje imperativo de inversión. Cuando falten datos, la interfaz debe decirlo. El usuario conserva la decisión; la IA puede ordenar preguntas, resumir, comparar hipótesis y señalar contradicciones.

Etiqueta recomendada: **«Asistente educativo · Puede equivocarse · Verifica fuentes y fechas»**.

## 11. Publicidad y compliance

El disclaimer mínimo para campañas es:

> Simulación educativa · Saldo DEMO sin valor monetario · No es asesoramiento financiero.

Debe estar integrado en la composición, tener contraste suficiente y seguir legible al tamaño real de publicación. No se oculta con gradientes, recortes ni botones.

La publicidad programática debe separarse visualmente del contenido mediante la etiqueta «Publicidad». Nunca se ubica dentro de gráficos, evaluaciones, confirmaciones de simulación, alertas de riesgo, respuestas de IA o checkout. No imitar botones del producto ni incentivar clics. La personalización publicitaria exige consentimiento y la configuración legal correspondiente en cada mercado.

## 12. Gobernanza

Todo cambio de color, logo o tipografía requiere actualizar primero `brand-tokens.json`, luego CSS, manual y derivados. Las campañas conservan su SVG editable, PNG final, copy y manifest. Registrar versión, fecha, responsable y motivo. Antes de publicar: revisar dimensiones, contraste, ortografía, CTA, disclaimer, derechos de recursos y que ninguna afirmación sugiera rendimiento financiero.
