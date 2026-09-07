'use client';

import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';

/**
 * Constelación de instrumentos reales para la bienvenida.
 *
 * Cada activo es un disco con su logotipo a sangre: los SVG del catálogo ya
 * traen su propio fondo -el naranja de Bitcoin, el degradado de Apple-, así que
 * recortarlos en círculo los deja llenos de color en lugar de un glifo flotando
 * sobre un hueco.
 *
 * La animación tiene un trabajo concreto y no es decorar: la escena tiene que
 * decir "aquí hay muchos mercados y giran" antes de que nadie lea el titular.
 * Por eso los anillos rotan de forma continua y en sentidos opuestos, mientras
 * cada disco **contragira** a la misma velocidad para que su logotipo nunca
 * quede boca abajo. Un logotipo girando se lee como un adorno; uno que se
 * mantiene derecho mientras su órbita se mueve se lee como un sistema.
 *
 * Con `prefers-reduced-motion` la composición se queda quieta y completa: nadie
 * pierde información por no querer movimiento.
 */

interface OrbitAsset {
  symbol: string;
  label: string;
  src: string;
}

/** Anillo interior: los más reconocibles, que son el gancho. */
const INNER: OrbitAsset[] = [
  { symbol: 'BTCUSD', label: 'Bitcoin', src: '/assets/instruments/btc.svg' },
  { symbol: 'AAPL', label: 'Apple', src: '/assets/instruments/apple.svg' },
  { symbol: 'TSLA', label: 'Tesla', src: '/assets/instruments/tesla.svg' },
  { symbol: 'ETHUSD', label: 'Ethereum', src: '/assets/instruments/eth.svg' },
  { symbol: 'MSFT', label: 'Microsoft', src: '/assets/instruments/microsoft.svg' },
];

/** Anillo exterior: amplía el universo sin competir con el interior. */
const OUTER: OrbitAsset[] = [
  { symbol: 'NVDA', label: 'NVIDIA', src: '/assets/instruments/nvidia.svg' },
  { symbol: 'AMZN', label: 'Amazon', src: '/assets/instruments/amazon.svg' },
  { symbol: 'SOLUSD', label: 'Solana', src: '/assets/instruments/sol.svg' },
  { symbol: 'XRPUSD', label: 'XRP', src: '/assets/instruments/xrp.svg' },
  { symbol: 'GLD', label: 'Oro', src: '/assets/instruments/metal-gold.svg' },
  { symbol: 'LINKUSD', label: 'Chainlink', src: '/assets/instruments/link.svg' },
  { symbol: 'DOGEUSD', label: 'Dogecoin', src: '/assets/instruments/doge.svg' },
];

function Ring({
  assets,
  radius,
  duration,
  reverse,
  size,
  reduce,
  delay,
}: {
  assets: OrbitAsset[];
  radius: number;
  duration: number;
  reverse: boolean;
  size: number;
  reduce: boolean;
  delay: number;
}) {
  const spin = reverse ? [360, 0] : [0, 360];
  const counter = reverse ? [-360, 0] : [0, -360];

  return (
    <motion.div
      className="orbit-ring"
      animate={reduce ? undefined : { rotate: spin }}
      transition={reduce ? undefined : { duration, ease: 'linear', repeat: Infinity }}
    >
      {assets.map((asset, index) => {
        const angle = (index / assets.length) * 2 * Math.PI;
        return (
          <motion.span
            key={asset.symbol}
            className="orbit-slot"
            style={{
              // Se posiciona por transformación y no por `top`/`left` para que
              // el navegador lo componga en la GPU y no recalcule el diseño en
              // cada fotograma de la rotación.
              transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}%, ${Math.sin(angle) * radius}%)`,
              width: size,
              height: size,
            }}
            // Con movimiento reducido no se anima nada: `initial={false}` deja
            // la pieza ya colocada. Empezar en opacidad cero y no animar la
            // dejaria invisible para siempre.
            initial={reduce ? false : { opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reduce ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 22, delay: delay + index * 0.07 }
            }
          >
            <motion.span
              className="orbit-token"
              // El contragiro mantiene cada logotipo derecho mientras su órbita
              // se mueve. Sin esto todo da vueltas y parece un carrusel.
              animate={reduce ? undefined : { rotate: counter }}
              transition={reduce ? undefined : { duration, ease: 'linear', repeat: Infinity }}
            >
              <img src={asset.src} alt="" width={size} height={size} loading="eager" decoding="async" />
            </motion.span>
          </motion.span>
        );
      })}
    </motion.div>
  );
}

export function AssetOrbit({ reduce }: { reduce: boolean }) {
  const names = [...INNER, ...OUTER].map((a) => a.label);

  return (
    <div className="asset-orbit" role="img" aria-label={`Mercados disponibles: ${names.join(', ')} y más.`}>
      {/* Halo. Da profundidad sin recurrir al cristal esmerilado, que en una
          tarjeta estática solo simula un material que no existe. */}
      <span className="orbit-halo" aria-hidden="true" />

      <Ring assets={OUTER} radius={44} duration={64} reverse size={42} reduce={reduce} delay={0.22} />
      <Ring assets={INNER} radius={27} duration={42} reverse={false} size={54} reduce={reduce} delay={0.06} />

      <motion.span
        className="orbit-core"
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 20 }}
      >
        <Logo size="lg" withWordmark={false} />
      </motion.span>

      {/* Pulso que sale del centro: sugiere que el mercado late, sin fingir un
          precio concreto que no tenemos en esta pantalla. */}
      {!reduce && (
        <>
          <span className="orbit-pulse" aria-hidden="true" />
          <span className="orbit-pulse orbit-pulse--late" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
