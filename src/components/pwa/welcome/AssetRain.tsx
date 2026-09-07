'use client';

import type { CSSProperties } from 'react';
import { Logo } from '@/components/Logo';

/**
 * Lluvia de mercados: la primera imagen de la aplicación.
 *
 * La escena cuenta algo en tres tiempos, que es lo que hace que una animación se
 * mire entera en vez de dos segundos:
 *
 *   1. **Caen.** Los instrumentos entran desde arriba con aceleración de
 *      gravedad -lentos al salir, rápidos al llegar- y empiezan los del fondo,
 *      así que la pila se construye a la vista en lugar de aparecer hecha.
 *   2. **Rebotan.** Tres botes, cada uno más corto, con un aplastamiento de tres
 *      centésimas al tocar el suelo y una sombra de contacto que se ensancha
 *      justo en el impacto. Esas dos cosas son la mitad del efecto: sin ellas un
 *      disco que sube y baja parece un ascensor; con ellas, pesa.
 *   3. **Se asientan y respiran**, cada pieza con su propia fase. La escena
 *      queda viva sin quedarse inquieta.
 *
 * El logotipo de TradingLab cae **el último**, es el más grande y aterriza en el
 * centro de la primera fila. Ese orden es el argumento de la escena: primero
 * llega el mercado -cripto, acciones, fondos, divisas, oro, índices- y encima
 * llega la herramienta para mirarlo. Cayendo primero sería un anuncio; cayendo
 * al final es una conclusión.
 *
 * La geometría de la pila está calculada para que **ningún disco se solape con
 * su vecino**. Doce piezas bien separadas se leen; dieciséis amontonadas se ven
 * como una mancha, que es exactamente lo que pasaba antes.
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
  /** Diámetro en píxeles, sobre una escena de referencia de 340 px de ancho. */
  size: number;
  /** Fila de profundidad: 0 es el fondo, 3 es la primera fila. */
  depth: 0 | 1 | 2 | 3;
  /** Segundos que tarda en empezar a caer. */
  delay: number;
}

/** Ancho de referencia. Solo se usa para pasar tamaños a porcentaje. */
const SCENE = 340;

/**
 * El montón.
 *
 * Las cuatro filas cubren a propósito las seis familias del catálogo -cripto,
 * acciones, fondos cotizados, divisas, materias primas e índices- porque el
 * titular de esta pantalla promete justamente eso.
 *
 * Las posiciones están repartidas para que cada disco tenga aire alrededor: en
 * la fila de delante, un disco de 56 px sobre una escena de 340 ocupa un 16 %
 * del ancho, así que tres piezas centradas en el 15, el 50 y el 85 % dejan un
 * hueco limpio entre cada una. Las alturas están desparejadas a mano: una pila
 * perfectamente alineada se lee como una cuadrícula, no como algo que acaba de
 * caer.
 */
const PIECES: RainPiece[] = [
  // Fondo: los primeros en caer, los últimos en leerse.
  { id: 'SOLUSD', label: 'Solana', src: '/assets/instruments/sol.svg', x: 12, y: 49, size: 32, depth: 0, delay: 0 },
  { id: 'USDJPY', label: 'Yen japonés', src: '/assets/instruments/flag-jp.svg', x: 88, y: 46, size: 32, depth: 0, delay: 0.09 },

  { id: 'TSLA', label: 'Tesla', src: '/assets/instruments/tesla.svg', x: 22, y: 32, size: 40, depth: 1, delay: 0.2 },
  { id: 'XAUUSD', label: 'Oro', src: '/assets/instruments/metal-gold.svg', x: 50, y: 35, size: 42, depth: 1, delay: 0.29 },
  { id: 'NAS100', label: 'Nasdaq 100', src: '/assets/instruments/indices-nasdaq-100.svg', x: 78, y: 31, size: 40, depth: 1, delay: 0.38 },

  { id: 'EURUSD', label: 'Euro / dólar', src: '/assets/instruments/flag-eu.svg', x: 8, y: 17, size: 46, depth: 2, delay: 0.49 },
  { id: 'ETHUSD', label: 'Ethereum', src: '/assets/instruments/eth.svg', x: 33, y: 15, size: 48, depth: 2, delay: 0.58 },
  { id: 'SPY', label: 'SPDR S&P 500', src: '/assets/instruments/spdr-sandp500-etf-tr.svg', x: 67, y: 15, size: 48, depth: 2, delay: 0.67 },
  { id: 'NVDA', label: 'NVIDIA', src: '/assets/instruments/nvidia.svg', x: 92, y: 18, size: 46, depth: 2, delay: 0.76 },

  // Primera fila: los más reconocibles, los que sostienen la escena.
  { id: 'BTCUSD', label: 'Bitcoin', src: '/assets/instruments/btc.svg', x: 15, y: 1, size: 56, depth: 3, delay: 0.88 },
  { id: 'AAPL', label: 'Apple', src: '/assets/instruments/apple.svg', x: 85, y: 2, size: 54, depth: 3, delay: 0.97 },
];

/** Lluvia de fondo: no llega a la pila, solo dice que sigue cayendo mercado. */
const DRIZZLE = [
  { id: 'd1', src: '/assets/instruments/link.svg', x: 27, size: 19, delay: 2.6, duration: 7.2 },
  { id: 'd2', src: '/assets/instruments/vanguard.svg', x: 58, size: 16, delay: 4.4, duration: 8.4 },
  { id: 'd3', src: '/assets/instruments/xrp.svg', x: 74, size: 18, delay: 3.4, duration: 6.6 },
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
  const travel = SCENE * (1 - piece.y / 100) + 34;
  return `${-Math.round((travel / piece.size) * 100)}%`;
}

/**
 * El tamaño va en porcentaje del ancho de la escena, no en píxeles.
 *
 * Es lo que hace que el montón se vea igual de aireado en un móvil estrecho que
 * en un portátil: con medidas fijas, la misma pila que respira en 340 px se
 * amontona en 260 y los discos se solapan.
 */
const asWidth = (size: number) => `${((size / SCENE) * 100).toFixed(2)}%`;

function pieceStyle(piece: RainPiece, reduce: boolean): CSSProperties {
  return {
    left: `${piece.x}%`,
    bottom: `${piece.y}%`,
    width: asWidth(piece.size),
    zIndex: piece.depth + 2,
    ...(reduce
      ? {}
      : ({
          '--rain-drop': dropDistance(piece),
          '--rain-delay': `${piece.delay}s`,
          // El primer bote es más alto en las piezas ligeras del fondo: pesan
          // menos, y eso se cuenta con la altura del rebote, no con el tamaño.
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

      {/* Luz de suelo. Una elipse difusa pegada a la base, no un rectángulo: lo
          que se busca es que la pila apoye sobre algo, no enmarcarla. */}
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
            {/* La sombra de contacto se ensancha justo en el impacto. Es lo que
                convierte una traslación vertical en un golpe contra el suelo. */}
            {!reduce && <span className="rain-contact" aria-hidden="true" />}
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

      {/* La marca cae la última y se queda delante de todo. */}
      <span
        className="rain-piece rain-brand"
        aria-hidden="true"
        style={{
          left: '50%',
          bottom: '0%',
          width: asWidth(84),
          zIndex: 7,
          ...(reduce
            ? {}
            : ({
                '--rain-drop': `${-Math.round(((SCENE + 34) / 84) * 100)}%`,
                '--rain-delay': '1.14s',
                '--rain-hop': '-26%',
              } as CSSProperties)),
        }}
      >
        <span className="rain-fall">
          {!reduce && <span className="rain-contact" aria-hidden="true" />}
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
