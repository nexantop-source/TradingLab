# Sistema de diseño, arquitectura de información y flujos

## 1. Dirección visual

El concepto rector sigue siendo **«Criterio antes que certeza»**, expresado ahora con una dirección
de producto silenciosa: tipografía de sistema protagonista, fondos neutros, superficies blancas,
materiales translúcidos, grandes radios y movimiento mínimo. La inspiración es el nivel de claridad
y jerarquía de Apple, sin copiar sus activos, componentes ni identidad.

Se eliminan rejillas decorativas, órbitas dominantes, neón saturado, exceso de bordes, confeti,
mecánicas de casino, cifras de usuarios inventadas y testimonios ficticios.

## 2. Tokens

Definidos en `src/app/globals.css` mediante `@theme`. Los componentes **nunca** usan colores
literales: siempre `var(--color-*)`.

### Color

Rampa **acromática**. En un producto financiero los únicos colores saturados de la pantalla deben
ser el dato (P&L) y la acción primaria; un fondo con tinte azul compite con ambos. Verificado por
`tests/design-tokens.test.ts`, que falla si `--color-bg` deja de ser neutro.

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--color-bg` | `#09090B` | `#F5F5F7` | Fondo de la aplicación |
| `--color-surface` | `#111113` | `#FFFFFF` | Tarjetas y paneles |
| `--color-elevated` | `#1A1A1D` | `#FFFFFF` | Modales, menús, elementos flotantes |
| `--color-overlay` | blanco 4 % | tinta 4 % | Velos y estados hover |
| `--color-border` | blanco 7 % | tinta 8 % | Separadores |
| `--color-border-strong` | blanco 12 % | tinta 14 % | Bordes de control |
| `--color-text` | `#FAFAFA` | `#1D1D1F` | Texto principal |
| `--color-muted` | `#A1A1A6` | `#6E6E73` | Texto secundario |
| `--color-subtle` | `#71717A` | `#86868B` | Texto terciario y metadatos |
| `--color-blue` | `#0A84FF` | `#0071E3` | **Único** color de acción |
| `--color-violet` | `#7D7AFF` | `#5856D6` | Contexto y entrenador |
| `--color-positive` | `#30D158` | `#16834B` | Dato al alza. Nunca una superficie |
| `--color-negative` | `#FF453A` | `#D70015` | Dato a la baja o error, siempre con texto o icono |
| `--color-gold` | `#FFD60A` | `#9A6700` | DEMO y advertencias |
| `--color-lime` | `#B7F34A` | `#547B00` | Acento educativo puntual |

Cada color tiene su variante `-soft` para fondos. El modo de alto contraste sustituye todos los
valores por una paleta reforzada sobre negro puro.

En las superficies de la app instalada **no se admite ningún color literal**: el test los rechaza.
La única excepción es `#ffffff` sobre el azul de acción, donde el fondo no cambia con el tema.

### Tipografía

Escala de nueve pasos. La zona densa (11–17 px) sostiene tablas, etiquetas y datos; a partir de
21 px la razón es ~1,26. **11 px es el suelo absoluto** y solo se usa con `letter-spacing` positivo.

| Token | px | Uso |
|---|---|---|
| `--text-2xs` | 11 | Micro-etiquetas, cabeceras de tabla, eyebrows |
| `--text-xs` | 13 | Texto secundario, tablas densas |
| `--text-sm` | 15 | Cuerpo |
| `--text-md` | 17 | Cuerpo enfatizado, títulos de lista |
| `--text-lg` | 21 | Títulos de tarjeta y sección |
| `--text-xl` | 26 | Títulos de página |
| `--text-2xl` | 33 | Titular corto |
| `--text-3xl` | 42 | Titular |
| `--text-4xl` | 54 | Display |

Interlineado por función: `--leading-tight` 1,15 · `snug` 1,35 · `normal` 1,55 · `relaxed` 1,7.
Tracking: `--tracking-display` −0,03em · `tight` −0,015em · `label` 0,08em · `eyebrow` 0,14em.

Ningún `font-size` se escribe en px. Se admite `clamp()` para tipografía fluida de titulares.

- **Tipografía de sistema** — `-apple-system`, `BlinkMacSystemFont`, SF Pro si está disponible e Instrument Sans como respaldo.
- **JetBrains Mono** — precios, porcentajes, indicadores, identificadores y cualquier dato
  financiero. Se aplica con la utilidad `.num`, que además activa `tabular-nums` para que las
  columnas de cifras no bailen.

### Espacio

Escala de base 4: `--space-px` 2 · `1` 4 · `2` 8 · `3` 12 · `4` 16 · `5` 20 · `6` 24 · `8` 32 ·
`10` 40 · `12` 48 · `16` 64 · `20` 80. Cubre `gap`, `padding` y `margin`. Los valores negativos son
correcciones ópticas deliberadas y quedan fuera de la escala.

Las alturas mínimas de objetivo táctil (44 px, 48 px) **no** son espacio: son accesibilidad y se
escriben en px a propósito.

### Radios, sombras y materiales

`--radius-2xs` 4 px · `xs` 8 · `sm` 12 · `md` 16 · `lg` 20 · `xl` 28 · `full` 999. Ningún
`border-radius` se escribe en px.

Dos sombras: `--shadow-soft` (tarjetas) y `--shadow-lifted` (elementos flotantes), más
`--shadow-focus` para el anillo de foco. En oscuro son mínimas a propósito: sobre un fondo casi
negro la elevación se lee por superficie y borde, no por sombra. En alto contraste se sustituyen
por bordes sólidos.

**Cristal esmerilado (`backdrop-filter`)**: se reserva al cromo que flota sobre contenido que se
desplaza — cabecera, navegación, drawers, scrims, `::backdrop` y paleta de comandos. Sobre una
tarjeta estática no comunica capa y es el rasgo más reconocible de una interfaz generada; el test
lo rechaza. Siempre con respaldo bajo `prefers-reduced-transparency`.

Curvas: `--ease-out-soft` para entradas, `--ease-in-out-soft` para transiciones. Duraciones entre
200 y 500 ms. Nada rebota, nada gira.

### Utilidades propias

`.surface` · `.surface-elevated` · `.glass` · `.num` · `.editorial` · `.mesh-aurora` ·
`.text-gradient` · `.grid-lines` · `.skeleton`

## 3. Modos visuales

Cuatro combinaciones, aplicadas en `data-theme` y `data-reduce-motion` sobre `<html>`:

1. **Oscuro** — experiencia principal.
2. **Claro** — profesional y completo, no una degradación.
3. **Alto contraste** — contraste reforzado, bordes marcados, sin sombras.
4. **Movimiento reducido** — respeta `prefers-reduced-motion` del sistema y la preferencia guardada
   del perfil.

Un script inline en el `<head>` aplica el tema antes del primer pintado, evitando el destello.

## 4. Componentes

`packages/ui/primitives.tsx`: Button (7 variantes × 3 tamaños), Card, Badge (6 tonos), Field, Input,
Textarea, Select, Checkbox, Segmented, Callout, Progress, Delta, EmptyState, InfoTip, Modal,
DataTable, Tabs, Skeleton, Spinner.

`packages/ui/compliance.tsx`: DemoBadge, VirtualBalance, SimulationDisclaimer, AIDisclaimer,
SimulationPill, RiskWarning, ServiceNature. Existen para que **ningún aviso legal se escriba a
mano**: el texto tiene un único origen en `packages/types/compliance.ts` y una revisión de
cumplimiento cambia un archivo.

`packages/ui/chart/PriceChart.tsx`: gráfico propio sobre canvas.

`packages/ui/DataProvenanceBadge.tsx`: procedencia del dato, siempre visible junto a cada precio.

### Detalles con intención

- **Delta** no depende solo del color: incluye signo, flecha (▲▼■) y una lectura para lector de
  pantalla («sube», «baja», «sin cambio»).
- **Las velas alcistas se dibujan rellenas y las bajistas huecas.** La forma comunica la dirección
  aunque no se distinga rojo de verde.
- **DataTable** se convierte en tarjetas apiladas por debajo de `md`, con las columnas marcadas como
  `hideOnMobile` ocultas.
- **Modal** retiene el foco, cierra con Escape, bloquea el scroll y devuelve el foco al elemento que
  lo abrió.

## 5. Mapa del sitio

```
PÚBLICO
  /                          Landing
  /precios                   Planes, tabla comparativa, reglas comerciales, FAQ
  /mercados                  Catálogo completo de instrumentos
  /recursos                  Rutas educativas, artículos y accesos
  /glosario                  30 términos por categoría
  /legal                     Centro legal
  /legal/[slug]              7 documentos versionados
  /estado                    Estado del servicio en tiempo real
  /anunciantes               Inventario, paquetes y normas editoriales
  /contacto                  Canales de contacto e información corporativa
  /entrar  ·  /crear-cuenta  Autenticación

PRODUCTO (requiere sesión)
  /onboarding                5 pasos: bienvenida, intereses, objetivo, evaluación, resultado
  /panel                     Saldo, disciplina, racha, posiciones, ruta, mercados, eventos
  /terminal                  Terminal de simulación
  /academia                  Rutas y progreso
  /academia/[track]          Cursos, módulos y lecciones
  /academia/leccion/[slug]   Lección con bloques, cuestionario y requisitos
  /diario                    Entradas, pendientes de documentar, patrones
  /estadisticas              Disciplina, métricas, desgloses, evolución
  /entrenador                Análisis educativo con IA
  /retos                     Nivel, retos activos, insignias
  /calendario                Calendario económico
  /noticias  ·  /noticias/[slug]
  /perfil                    Cuenta, suscripción, accesibilidad, privacidad
  /ayuda                     Centro de ayuda y formulario de soporte

ADMINISTRACIÓN (requiere permiso)
  /admin                     Resumen con métrica principal
  /admin/usuarios            /admin/suscripciones      /admin/contenido
  /admin/simulaciones        /admin/ia                 /admin/datos
  /admin/publicidad          /admin/analitica          /admin/cumplimiento
  /admin/soporte             /admin/auditoria
```

## 6. Flujos principales

### Registro y activación

```
Landing ─▶ Crear cuenta ─▶ [3 consentimientos obligatorios]
   │
   ├─ Se crea la cuenta DEMO con USD 10.000 y su asiento de apertura
   ├─ Se registran los consentimientos con la versión del documento
   │
   ▼
Onboarding
   1. Bienvenida — se explica qué NO es la plataforma antes que qué es
   2. Mercados de interés
   3. Objetivo educativo y disponibilidad
   4. Evaluación de 8 preguntas sobre riesgo (no sobre trading)
   5. Resultado — clasificación, ruta recomendada y repaso de las respuestas
   │
   ▼
Se recomienda completar la primera lección ANTES de la terminal
```

La evaluación mide comprensión del riesgo, no conocimiento técnico. Una respuesta «no lo sé» no
penaliza: informa.

### Crear una simulación

```
Terminal ─▶ elegir instrumento y temporalidad ─▶ aplicar indicadores
   │
   ▼
Panel de simulación
   · monto virtual → se muestra el % del saldo que representa
   · aviso si supera el 5 %
   · parámetros según el modo
   · motivo escrito obligatorio (mínimo 15 caracteres)
   · confianza y riesgo percibido declarados
   │
   ▼  «Crear hipótesis alcista» / «Crear hipótesis bajista»
   │   (nunca «arriba»/«abajo», nunca con forma de botón de apuesta)
   ▼
Confirmación — pantalla completa, sin publicidad posible
   · precio inicial · hora de cierre · condición de acierto
   · RIESGO VIRTUAL MÁXIMO destacado, en importe y en % del saldo
   · comisión virtual de apertura
   · aviso de simulación
   · casilla de confirmación explícita, obligatoria
   │
   ▼
Servidor: plan → límite → instrumento → mercado → niveles → saldo
   → congela contexto → dos asientos en el libro mayor
```

### Cerrar y aprender

```
Vencimiento o cierre manual
   ▼
Motor: comprueba disparos → calcula → traza de auditoría → asiento de liquidación
   ▼
Historial ─▶ «Documentar en el diario»
   ▼
Diario: hipótesis, emoción antes y después, riesgo, error, lección, etiquetas
   ▼
Entrenador IA: revisión posterior que evalúa el PROCESO, no el resultado
   ▼
Estadísticas: la puntuación de disciplina se recalcula
```

### Aprender

```
Academia ─▶ Ruta ─▶ Lección
   bloques: texto · aviso · ejemplo · gráfico real · ejercicio · lista de comprobación
   ▼
Cuestionario corregido en el servidor, con explicación de cada respuesta
   ▼
¿Requiere simulación práctica? ─ sí ─▶ Terminal ─▶ vuelta a la lección
   ▼
Completar → XP → posible insignia → siguiente lección
```

## 7. Accesibilidad

Objetivo: WCAG 2.1 AA.

- Navegación completa con teclado; foco visible de 2 px con desplazamiento, nunca eliminado.
- Enlace de salto al contenido en cada página.
- El gráfico es `aria-hidden` y va acompañado de un resumen textual y una tabla oculta con las
  últimas velas, de modo que un lector de pantalla accede a la misma información.
- La dirección nunca se comunica solo con color: forma, flecha, signo y texto.
- Errores de formulario con `role="alert"`, `aria-invalid` y `aria-describedby`.
- Área táctil mínima de 44 px en dispositivos de puntero grueso.
- Tipografía escalable: todos los tamaños en unidades relativas.
- `prefers-reduced-motion` respetado, más preferencia propia en el perfil.
- Los vídeos incluirán subtítulos y transcripción completa.

## 8. Experiencia móvil

- La terminal reserva la mayor parte de la pantalla al gráfico.
- El panel de simulación se abre como hoja inferior, con la barra de acción fija respetando
  `env(safe-area-inset-bottom)`.
- La lista de seguimiento es deslizable.
- Las tablas se convierten en tarjetas.
- **Nunca coexisten dos barras de navegación**: la barra inferior desaparece en la terminal.
- Los anuncios reservan su alto antes de solicitarse y muestran contenido propio contextual si no
  hay relleno; nunca cubren controles.
- PWA instalable con accesos directos a terminal, academia y diario.
