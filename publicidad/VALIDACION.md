# Evidencia de validación

**Fecha:** 2026-08-29

## Validación automática

Comando ejecutado:

```powershell
node scripts/generate-brand-assets.mjs
```

Resultado:

- 15 SVG publicitarios encontrados.
- 15 PNG publicitarios renderizados y leídos correctamente.
- 5 conceptos × 3 formatos.
- Dimensiones exactas: 5 × 1080×1080, 5 × 1080×1350 y 5 × 1200×628.
- Disclaimer exacto encontrado como texto en los 15 SVG.
- 6 SVG de logo y 6 PNG derivados validados.
- Checksums SHA-256 registrados en `manifest.json`.

## QA visual

Se inspeccionaron las 15 piezas renderizadas y las seis variantes de logo. En los tres formatos se comprobó:

- ausencia de recortes y solapamientos;
- jerarquía de headline, apoyo, arte, CTA y disclaimer;
- área segura lateral y reserva inferior;
- contraste del disclaimer y CTA;
- cinco lenguajes visuales materialmente distintos pero coherentes;
- ausencia de velas, flechas de rentabilidad, monedas, ganancias, señales u órdenes de compra/venta.

## Fuentes y recursos

- 4 subconjuntos latinos WOFF2 presentes, con mapeo, copyright exacto y OFL 1.1.
- La textura de campaña original se copió sin borrar ni alterar el master de origen.
- Los SVG son la fuente editable; los PNG son derivados reproducibles.
