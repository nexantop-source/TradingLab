# Sistema de diseño, arquitectura de información y flujos

## 1. Dirección visual

La referencia no es una plataforma de trading: es un producto editorial serio con datos densos.
Minimalismo financiero, fondos oscuros profundos, degradados mesh muy contenidos, superficies
translúcidas con blur moderado, profundidad por sombra suave y jerarquía tipográfica fuerte.

Lo que se evita deliberadamente: neón saturado, exceso de tarjetas y bordes, confeti, mecánicas de
casino, cifras de usuarios inventadas y testimonios ficticios.

## 2. Tokens

Definidos en `src/app/globals.css` mediante `@theme`. Los componentes **nunca** usan colores
literales: siempre `var(--color-*)`.

### Color

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--color-bg` | `#070A12` | `#F7F9FC` | Fondo de la aplicación |
| `--color-surface` | `#0D1320` | `#FFFFFF` | Tarjetas y paneles |
| `--color-elevated` | `#131B2B` | `#FFFFFF` | Modales, menús, elementos flotantes |
| `--color-border` | blanco 8 % | tinta 8 % | Separadores |
| `--color-border-strong` | blanco 12 % | tinta 14 % | Bordes de control |
| `--color-text` | `#F8FAFC` | `#0B1220` | Texto principal |
| `--color-muted` | `#98A4B7` | `#55647C` | Texto secundario |
| `--color-subtle` | `#64748B` | `#7B8AA1` | Texto terciario y metadatos |
| `--color-blue` | `#5B8CFF` | `#2F62E8` | Acción primaria, enlaces |
| `--color-violet` | `#8B5CF6` | `#7038D6` | Inteligencia artificial, gamificación |
| `--color-positive` | `#20D6A2` | `#0F9F78` | Alcista, correcto |
| `--color-negative` | `#FF6178` | `#D92B48` | Bajista, incorrecto |
| `--color-gold` | `#F3B95F` | `#B47C19` | DEMO, advertencias, patrocinios |

Cada color tiene su variante `-soft` para fondos, generada con opacidad. El modo de alto contraste
sustituye todos los valores por una paleta de contraste reforzado sobre negro puro.

### Tipografía

- **Instrument Sans** — toda la interfaz.
- **Instrument Serif** — solo titulares editoriales de la landing, en cursiva, como acento.
- **JetBrains Mono** — precios, porcentajes, indicadores, identificadores y cualquier dato
  financiero. Se aplica con la utilidad `.num`, que además activa `tabular-nums` para que las
  columnas de cifras no bailen.

### Radios, sombras y curvas

`--radius-xs` 6 px · `sm` 10 px · `md` 14 px · `lg` 20 px · `xl` 28 px.

Tres sombras: `soft` (tarjetas), `lifted` (elementos flotantes), `glow-blue` (acción primaria). En
alto contraste se sustituyen por bordes sólidos.

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
- Los anuncios reservan su alto antes de solicitarse y se colapsan si no hay relleno; nunca cubren
  controles.
- PWA instalable con accesos directos a terminal, academia y diario.
