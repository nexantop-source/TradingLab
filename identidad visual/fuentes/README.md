# Tipografías

Los WOFF2 de esta carpeta son subconjuntos latinos producidos por `next/font/google` durante la compilación local. No son conversiones ni modificaciones manuales. Se copian junto con los avisos de copyright y la licencia SIL Open Font License 1.1.

## Mapeo exacto

| Archivo de identidad | Archivo de build | Uso | Rango |
|---|---|---|---|
| `instrument-sans-latin.woff2` | `26d0ba92e140f0dc-s.p.woff2` | UI y contenido | 400–700 variable |
| `instrument-serif-regular-latin.woff2` | `e6099e249fd938cc-s.p.woff2` | Editorial | 400 regular |
| `instrument-serif-italic-latin.woff2` | `9cc5b37ab1350db7-s.p.woff2` | Editorial | 400 italic |
| `jetbrains-mono-latin.woff2` | `bb3ef058b751a6ad-s.p.woff2` | Datos y estados | 100–800 variable |

## Carga local

Importa `fonts.css` desde una hoja que conserve las rutas relativas o copia sus cuatro declaraciones `@font-face`. No cargues simultáneamente estos binarios y la misma familia desde un proveedor remoto.

Consulta `LICENCIAS.md` y `OFL-1.1.txt` antes de redistribuir.
