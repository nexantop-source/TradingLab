# Publicidad — TradingLab

Paquete de lanzamiento con cinco conceptos y tres formatos por concepto. Todos los masters son SVG editables y cada uno tiene un PNG final con la misma dimensión.

## Formatos

| Nombre | Dimensión | Uso sugerido |
|---|---:|---|
| Cuadrado | 1080×1080 | Meta/Instagram feed, display social |
| Vertical | 1080×1350 | Instagram/Facebook feed 4:5 |
| Horizontal | 1200×628 | LinkedIn, Facebook link, X y OG |

## Conceptos

1. **Aprende antes de arriesgar:** simulación como espacio para ensayar hipótesis.
2. **IA sin señales:** asistencia contextual que hace mejores preguntas.
3. **Ciclo de aprendizaje:** aprende, observa, formula y revisa.
4. **Disciplina y proceso:** checklist y diario por encima del impulso.
5. **Free transparente:** entrada gratuita, saldo DEMO y límites explícitos.

## Reglas de publicación

- Mantener el SVG como master y publicar el PNG.
- No recortar el disclaimer ni colocar controles de plataforma encima.
- Comprobar el preview en móvil antes de activar la campaña.
- No sustituir “DEMO” por “dinero”, “capital” o expresiones ambiguas.
- No añadir rentabilidad, señales, urgencia falsa ni testimonios de ganancias.
- Para comparar rendimiento creativo, cambia una variable por prueba y espera volumen suficiente antes de decidir.

## Generación y validación

```powershell
node scripts/generate-brand-assets.mjs
```

El comando rasteriza los 15 SVG, comprueba 15 PNG, dimensiones exactas, disclaimer obligatorio y seis variantes de logo. `manifest.json` registra los checksums SHA-256 de los PNG validados.
