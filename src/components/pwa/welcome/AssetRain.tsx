'use client';

import type { CSSProperties } from 'react';
import { Logo } from '@/components/Logo';

/**
 * Lluvia de mercados: la primera imagen de la aplicación.
 *
 * Antes había una constelación que giraba. Giraba bien, pero decía poco: unos
 * discos dando vueltas pueden ilustrar cualquier producto, y el movimiento
 * continuo no tiene principio ni final, así que tampoco tiene sentido. La
 * persona miraba dos segundos y pasaba de largo.
 *
 * Esto cuenta algo en tres tiempos, que es lo que hace que una animación se
 * mire entera:
 *
 *   1. **Caen.** Los instrumentos entran desde arriba, uno detrás de otro y con
 *      aceleración de gravedad: lentos al salir, rápidos al llegar. Empiezan los
 *      del fondo y terminan los de delante, así que la pila se construye a la
 *      vista en lugar de aparecer hecha.
 *   2. **Rebotan.** Cada uno bota tres veces, cada bote más corto que el
 *      anterior, y se aplasta al tocar el suelo. El aplastamiento es la mitad
 *      del truco: sin él un disco que sube y baja parece un ascensor, con él
 *      pesa. Del impacto sale un anillo que se expande y desaparece.
 *   3. **Se asientan y respiran.** Ya en reposo, cada pieza oscila unos pocos
 *      píxeles con su propia fase. La escena queda viva sin quedarse inquieta.
 *
 * El logotipo de TradingLab cae **el último**, es el más grande y aterriza en el
 * centro del montón. Ese orden es el argumento de toda la escena: primero llega
 * el mercado -cripto, acciones, fondos, divisas, oro- y encima llega la marca
 * que sirve para mirarlo. Si el logotipo cayera primero sería un anuncio; al
 * caer al final es una conclusión.
 *
 * Detrás sigue lloviendo en bucle, con discos pequeños y desenfocados que no
 * llegan a la pila. Dicen "hay mucho más" sin obligar a reiniciar la escena.
 *
 * Con `prefers-reduced-motion` la pila aparece ya montada y quieta: nadie pierde
 * información por no querer movimiento.
 */

interface RainPiece {
  /** Identificador estable, y también el instrumento cuando es seleccionable. */
  id: string;
  label: string;
  src: string;
  /** Centro del disco, en porcentaje del ancho de la escena. */
  x: number;
  /** Distancia del borde inferior del disco al suelo, en porcentaje del alto. */
  y: number;
  /** Diámetro en píxeles, sobre una escena de referencia de 340 px. */
  size: number;
  /** Fila de profundidad: 0 es el fondo, 3 es la primera fila. */
  depth: 0 | 1 | 2 | 3;
  /** Segundos que tarda en empezar a caer. */
  delay: number;
}

/** Escena de referencia. Solo se usa para calcular alturas de caída. */
const SCENE = 340;

/**
 * El montón.
 *
 * Las cuatro filas cubren a propósito las cinco familias del catálogo -cripto,
 * acciones, fondos cotizados, divisas y materias primas- porque el titular de
 * esta pantalla promete justamente eso. Las alturas están desparejadas a mano:
 * una pila perfectamente alineada se lee como una cuadrícula, no como algo que
 * acaba de caer.
 */
const PIECES: RainPiece[] = [
  // Fondo: los últimos en llegar a la vista, los primeros en caer.
  { id: 'SOLUSD', label: 'Solana', src: '/assets/instruments/sol.svg', x: 9, y: 44, size: 30, depth: 0, delay: 0 },
  { id: 'USDJPY', label: 'Yen japonés', src: '/assets/instruments/flag-jp.svg', x: 31, y: 41, size: 32, depth: 0, delay: 0.07 },
  { id: 'VOO', label: 'Vanguard S&P 500', src: '/assets/instruments/vanguard.svg', x: 69, y: 43, size: 32, depth: 0, delay: 0.14 },
  { id: 'XRPUSD', label: 'XRP', src: '/assets/instruments/xrp.svg', x: 91, y: 45, size: 30, depth: 0, delay: 0.21 },

  { id: 'TSLA', label: 'Tesla', src: '/assets/instruments/tesla.svg', x: 18, y: 28, size: 38, depth: 1, delay: 0.3 },
  { id: 'XAUUSD', label: 'Oro', src: '/assets/instruments/metal-gold.svg', x: 41, y: 31, size: 40, depth: 1, delay: 0.37 },
  { id: 'NAS100', label: 'Nasdaq 100', src: '/assets/instruments/indices-nasdaq-100.svg', x: 60, y: 29, size: 40, depth: 1, delay: 0.44 },
  { id: 'MSFT', label: 'Microsoft', src: '/assets/instruments/microsoft.svg', x: 82, y: 27, size: 38, depth: 1, delay: 0.51 },

  { id: 'EURUSD', label: 'Euro / dólar', src: '/assets/instruments/flag-eu.svg', x: 5, y: 16, size: 42, depth: 2, delay: 0.58 },
  { id: 'ETHUSD', label: 'Ethereum', src: '/assets/instruments/eth.svg', x: 31, y: 13, size: 46, depth: 2, delay: 0.65 },
  { id: 'SPY', label: 'SPDR S&P 500', src: '/assets/instruments/spdr-sandp500-etf-tr.svg', x: 68, y: 14, size: 46, depth: 2, delay: 0.72 },
  { id: 'NVDA', label: 'NVIDIA', src: '/assets/instruments/nvidia.svg', x: 95, y: 17, size: 42, depth: 2, delay: 0.79 },

  // Primera fila: los más reconocibles, los que sostienen la escena.
  { id: 'BTCUSD', label: 'Bitcoin', src: '/assets/instruments/btc.svg', x: 16, y: 2, size: 54, depth: 3, delay: 0.88 },
  { id: 'AAPL', label: 'Apple', src: '/assets/instruments/apple.svg', x: 84, y: 3, size: 52, depth: 3, delay: 0.96 },
];

/** Lluvia de fondo: no llega a la pila, solo dice que sigue cayendo mercado. */
const DRIZZLE = [
  { id: 'd1', src: '/assets/instruments/link.svg', x: 22, size: 20, delay: 2.4, duration: 6.8 },
  { id: 'd2', src: '/assets/instruments/ishares.svg', x: 47, size: 17, delay: 4.1, duration: 7.6 },
  { id: 'd3', src: '/assets/instruments/doge.svg', x: 74, size: 19, delay: 3.2, duration: 6.2 },
  { id: 'd4', src: '/assets/instruments/flag-gb.svg', x: 88, size: 16, delay: 5.5, duration: 8.1 },
];

/** Instrumentos que la escena deja tocar, y que actualizan el pie de foto. */
const SELECTABLE = new Set(['BTCUSD', 'AAPL', 'EURUSD', 'ETHUSD']);

/**
 * Altura desde la que cae una pieza, en porcentaje de su propio tamaño.
 *
 * Se expresa en porcentaje -y no en píxeles- porque así la caída se reescala
 * sola con la escena: `translateY` en porcentaje mide sobre la altura del propio
 * elemento. La pieza arranca justo por encima del borde superior, nunca dentro.
 */
function dropDistance(piece: RainPiece): string {
  const travel = SCENE * (1 - piece.y / 100) + 30;
  return `${-Math.round((travel / piece.size) * 100)}%`;
}

/**
 * El tamaño va en porcentaje del ancho de la escena, no en píxeles.
 *
 * Es lo que hace que el montón se vea igual de compacto en un móvil estrecho
 * que en un portátil: con medidas fijas, la misma pila que respira en 340 px se
 * amontona en 280. Los porcentajes de `translateY` siguen funcionando porque
 * miden sobre la altura del propio disco, que ahora escala con la escena.
 */
const asWidth = (size: number) => `${((size / SCENE) * 100).toFixed(2)}%`;

function pieceStyle(piece: RainPiece, reduce: boolean): CSSProperties {
  return {
    left: `${piece.x}%`,
    bottom: `${piece.y}%`,
    width: asWidth(piece.size),
    zIndex: piece.depth + 1,
    ...(reduce
      ? {}
      : ({
          '--rain-drop': dropDistance(piece),
          '--rain-delay': `${piece.delay}s`,
          // El primer bote es más alto en las piezas ligeras del fondo: pesan
          // menos y eso se cuenta con la altura del rebote, no con el tamaño.
          '--rain-hop': `${-38 + piece.depth * 5}%`,
        } as CSSProperties)),
  };
}

export function AssetRain({
  reduce,
  selected,
  onSelect,
}: {
  reduce: boolean;
  /** Instrumento activo en el pie de foto, para resaltarlo dentro de la pila. */
  selected?: string;
  onSelect?: (symbol: string) => void;
}) {
  const names = PIECES.map((piece) => piece.label);

  return (
    // No es `role="img"`: dentro de una imagen los botones no existen para un
    // lector de pantalla, y cuatro de estos discos se pueden tocar. Es un grupo
    // con una descripción, que conserva lo que la escena cuenta sin esconder lo
    // que la escena deja hacer.
    <div className="asset-rain" data-reduce={reduce ? 'true' : undefined} role="group" aria-label="Mercados cayendo en pantalla">
      <p className="sr-only">Instrumentos representados: {names.join(', ')} y más.</p>
      {/* Luz de fondo. Da profundidad sin recurrir al cristal esmerilado, que en
          una escena estática solo simula un material que no existe. */}
      <span className="rain-glow" aria-hidden="true" />

      {!reduce &&
        DRIZZLE.map((drop) => (
          <span
            key={drop.id}
            className="rain-drizzle"
            aria-hidden="true"
            style={
              {
                left: `${drop.x}%`,
                width: asWidth(drop.size),
                '--rain-delay': `${drop.delay}s`,
                '--rain-duration': `${drop.duration}s`,
              } as CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={drop.src} alt="" width={drop.size} height={drop.size} decoding="async" />
          </span>
        ))}

      {PIECES.map((piece) => {
        const interactive = SELECTABLE.has(piece.id) && Boolean(onSelect);
        const content = (
          <span className="rain-fall">
            <span className="rain-token">
              {/* SVG locales: sin rastreo, sin servicio remoto y sin depender de
                  la red para que la primera pantalla se vea completa. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={piece.src} alt="" width={piece.size} height={piece.size} loading="eager" decoding="async" />
            </span>
            {!reduce && <span className="rain-splash" aria-hidden="true" />}
          </span>
        );
        return interactive ? (
          <button
            key={piece.id}
            type="button"
            className="rain-piece rain-piece--tappable"
            style={pieceStyle(piece, reduce)}
            data-active={selected === piece.id || undefined}
            aria-label={`Descubrir ${piece.label}`}
            aria-pressed={selected === piece.id}
            onClick={() => onSelect?.(piece.id)}
          >
            {content}
          </button>
        ) : (
          <span key={piece.id} className="rain-piece" style={pieceStyle(piece, reduce)} aria-hidden="true">
            {content}
          </span>
        );
      })}

      {/* La marca cae la última y se queda delante de todo: primero el mercado,
          después la herramienta para mirarlo. */}
      <span
        className="rain-piece rain-brand"
        aria-hidden="true"
        style={{
          left: '50%',
          bottom: '0%',
          width: asWidth(82),
          zIndex: 6,
          ...(reduce
            ? {}
            : ({
                '--rain-drop': `${-Math.round(((SCENE + 34) / 82) * 100)}%`,
                '--rain-delay': '1.12s',
                '--rain-hop': '-26%',
              } as CSSProperties)),
        }}
      >
        <span className="rain-fall">
          <span className="rain-token rain-token--brand">
            <Logo size="lg" withWordmark={false} />
          </span>
          {!reduce && <span className="rain-splash rain-splash--brand" aria-hidden="true" />}
        </span>
      </span>

      {/* Línea de suelo. Sin ella los discos flotan; con ella hay algo contra lo
          que rebotar, y el rebote se entiende. */}
      <span className="rain-floor" aria-hidden="true" />
    </div>
  );
}
