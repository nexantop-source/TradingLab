# Identidades visuales de instrumentos

Catálogo explícito de 50 instrumentos en `instrument-identities.json`. No se
deducen logos a partir de una letra ni se reutiliza el icono de categoría como
marca. Los ETFs usan la marca de su gestora y conservan el ticker del fondo.
Los pares de divisas presentan las dos banderas en el orden base/cotizada.
Índices y materias primas tienen una representación específica del instrumento.

## Fuentes y marcas

- Cripto: [Cryptocurrency Icons](https://github.com/spothq/cryptocurrency-icons), CC0.
- Banderas: [flag-icons](https://github.com/lipis/flag-icons), MIT.
- Empresas, gestoras, índices y materias primas: imágenes referenciales del
  [catálogo de TradingView](https://www.tradingview.com/symbols/AMEX-SPY/).

Las URLs exactas de procedencia se conservan en `scripts/instrument-logo-sources.json`.
Los logotipos y marcas pertenecen a sus titulares; su aparición identifica
instrumentos y no implica afiliación, patrocinio ni autorización para otros usos.
Las licencias de las colecciones no conceden derechos sobre marcas comerciales.

Los SVG se sirven desde `public/assets/instruments`, sin peticiones de imágenes
a terceros durante la navegación. El descargador rechaza scripts, eventos,
foreignObject y referencias externas. El componente conserva dimensiones para
evitar saltos de layout, usa texto alternativo solo cuando no hay ticker al lado
y muestra el ticker exacto si una imagen falla. Las pruebas exigen cobertura total
del catálogo y la existencia de todos los archivos.
