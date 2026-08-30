# TradingLab — sistema de marca oficial 13A

Este paquete convierte la selección **13A** en un sistema de producción reproducible. El símbolo representa dos planos de una misma decisión: primero aprender y validar; después ejecutar en un entorno real. No comunica ganancias garantizadas.

## Archivos principales

- `svg/tradinglab-symbol-master.svg`: versión monocromática principal.
- `svg/tradinglab-symbol-duotone.svg`: ink + blue; versión distintiva recomendada.
- `svg/tradinglab-symbol-black.svg`: reproducción técnica a una tinta.
- `svg/tradinglab-symbol-inverse.svg`: uso sobre fondos oscuros.
- `svg/tradinglab-lockup-horizontal.svg` y `svg/tradinglab-lockup-stacked.svg`: wordmark Poppins SemiBold convertido a contornos; no requieren la fuente instalada.
- `svg/tradinglab-avatar.svg`: avatar cuadrado con esquinas redondeadas.
- `png/`: renders transparentes de símbolo en 2048, 1024, 512, 256, 128, 64, 48, 32, 24 y 16 px; además de lockups y avatar.
- `qa/tradinglab-13A-qa.png`: hoja visual de contraste, composición y reducciones.
- `manifest.json`: procedencia, métricas, hashes y validaciones.

## Paleta

| Token | Hex | Uso |
| --- | --- | --- |
| Ink | `#071324` | Marca principal, tipografía, fondos oscuros |
| Blue | `#185ADB` | Segundo plano del símbolo y acento |
| Paper | `#F7F9FC` | Fondos claros e inversión |

## Reglas rápidas

- Use el duotono sobre Paper o blanco. Sobre Ink/Blue, use el inverso.
- Mantenga un margen libre mínimo de **1/8 del ancho del símbolo** por cada lado.
- Tamaño digital recomendado del símbolo: **24 px o más**. La variante de 16 px se reserva para favicon o contingencia técnica.
- No cambie la relación entre los dos planos, no añada sombras ni estire el conjunto.
- En los lockups, no reescriba el wordmark: ya está convertido a geometría vectorial.

## Motion

Para el video promocional, anime primero el plano superior (aprendizaje/análisis), haga una pausa breve de validación y revele después el plano azul (ejecución real). Duración sugerida del reveal: 0,8–1,2 s, con easing preciso y sin rebote caricaturesco. Mantenga el mensaje **“Aprende. Practica. Luego opera en real.”** y evite claims de rentabilidad o ganancias aseguradas.

## Trazabilidad

- Maestro de entrada: `identidad visual/logo-master-13A-final-2026-08-29/manual-clean/tradinglab-symbol-master.svg`
- ViewBox de entrada: `0 0 1000 1000`
- Formas / paths de entrada: **2 / 2**
- Anclas vectoriales estimadas: **26**
- Curvas detectadas: **8**
- Wordmark: **Poppins SemiBold**, 10 glifos, convertido desde `C:/Windows/Fonts/Poppins-SemiBold.ttf`
- SVG de producción validados: **9**
- Archivos totales generados: **64**

## Regenerar

```powershell
node scripts/build-tradinglab-brand-system.mjs "ruta\al\simbolo-maestro.svg"
```

Puede indicar otra salida con `--output` y otra instalación de Poppins SemiBold con `--font`.
