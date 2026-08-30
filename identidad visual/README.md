# TradingLab — paquete de identidad visual

Este directorio es la fuente de verdad de la identidad de TradingLab. La idea central es **«Criterio antes que certeza»**: la marca no promete resultados financieros; ayuda a aprender, formular hipótesis y revisar decisiones en un entorno de simulación educativa.

## Contenido

- `manual-de-marca.md`: estrategia, sistema visual, tono, accesibilidad y compliance.
- `logos/`: archivos maestros SVG y entregables PNG.
- `tokens/`: variables de color, tipografía, espacio, radio, sombra y movimiento en CSS y JSON.
- `fuentes/`: subconjuntos latinos WOFF2 ya generados por `next/font`, avisos de copyright y licencia OFL 1.1.
- `recursos/`: master visual de campaña; no debe confundirse con un logo.

## Fuente de verdad

1. Los valores computables viven en `tokens/brand-tokens.json`.
2. Su versión lista para interfaz vive en `tokens/brand-tokens.css`.
3. Las reglas de aplicación viven en `manual-de-marca.md`.
4. Los SVG de `logos/` son los masters; los PNG son derivados.

No edites los PNG a mano. Para volver a generarlos y validar dimensiones:

```powershell
node scripts/generate-brand-assets.mjs
```

## Regla rápida

Si una pieza parece sugerir «ganancia segura», «señal de compra/venta» o dinero real, no pertenece a TradingLab. Si hace visible el proceso —pregunta, evidencia, hipótesis, revisión— sí.
