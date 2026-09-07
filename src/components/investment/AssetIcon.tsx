'use client';

import { useState } from 'react';
import type { AssetClass } from '@tl/types';
import identities from './instrument-identities.json';

interface Identity {
  label: string;
  src: string;
  secondary?: string;
  kind?: string;
}

const IDENTITIES = identities as Record<string, Identity>;

/**
 * Texto del monograma.
 *
 * No es el identificador interno recortado: es la parte que la persona
 * reconoce. De `USDBRL` importa el real -el dólar está en la mitad del
 * catálogo-, de `ATOMUSD` importa `ATOM`, y de un índice importa su ticker de
 * bolsa y no el nombre que le hayamos puesto dentro.
 */
export function monogramText(symbol: string, assetClass?: AssetClass, displayTicker?: string): string {
  const id = symbol.toUpperCase();
  // La clase no siempre llega: media aplicación pinta un icono sabiendo solo el
  // símbolo. Cuando falta se deduce de la forma, que para estos dos casos es
  // inequívoca, en lugar de recortar el identificador por la mitad y enseñar
  // "USDCO" donde debería poner "COP".
  const forex = assetClass === 'FOREX' || (!assetClass && /^[A-Z]{6}$/.test(id) && !id.endsWith('USDT'));
  if (forex && /^[A-Z]{6}$/.test(id)) {
    const base = id.slice(0, 3);
    return base === 'USD' ? id.slice(3) : base;
  }
  if (assetClass === 'CRYPTO' || (!assetClass && /^[A-Z0-9]{2,6}USDT?$/.test(id))) {
    const base = id.replace(/USDT$/, '').replace(/USD$/, '');
    if (base && base !== id) return base.slice(0, 5);
  }
  if (displayTicker) return displayTicker.replace(/[\^=F]/g, '').slice(0, 5) || id.slice(0, 5);
  return id.slice(0, 5);
}

/**
 * Color del monograma.
 *
 * Determinístico a partir del símbolo, no aleatorio: el mismo instrumento tiene
 * siempre el mismo color, en esta sesión y en la siguiente, y eso es lo que
 * permite reconocerlo de reojo en una lista larga.
 *
 * El color se expresa en OKLCH y no en HSL. La diferencia importa justo aquí:
 * en HSL, dos colores con la misma luminosidad declarada -un azul y un
 * amarillo verdoso al 40 %- se ven con un brillo completamente distinto, así
 * que sobre trescientos discos unos cuantos salen apagados y otros deslumbran.
 * OKLCH mide la luminosidad como la percibe el ojo, de modo que fijarla en un
 * número deja los 360 tonos igual de intensos y la lista se lee como una
 * familia en vez de como un bote de caramelos.
 */
export function monogramHue(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return hash % 360;
}

/**
 * Identidad de un instrumento.
 *
 * Los que la gente reconoce por su logotipo lo llevan; el resto recibe un
 * monograma con su propio ticker. Esa segunda vía no es un hueco a la espera de
 * un logotipo: con trescientos instrumentos en el catálogo, exigir arte para
 * cada uno significaría no poder añadir ninguno, y un ticker legible identifica
 * mejor que un icono genérico de "materia prima" repetido veinte veces.
 */
export function AssetIcon({ symbol, assetClass, ticker, name, size = 'md', decorative = true, className = '' }: {
  symbol: string;
  assetClass?: AssetClass;
  /** Ticker visible cuando difiere del identificador interno. */
  ticker?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg';
  decorative?: boolean;
  className?: string;
}) {
  const identity = IDENTITIES[symbol.toUpperCase()];
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const broken = !identity || failedSource === identity.src || failedSource === identity.secondary;
  const label = name ?? identity?.label ?? symbol;

  const shared = {
    role: decorative ? undefined : ('img' as const),
    'aria-hidden': decorative || undefined,
    'aria-label': decorative ? undefined : label,
    title: label,
  };

  if (broken) {
    const text = monogramText(symbol, assetClass, ticker);
    const hue = monogramHue(symbol.toUpperCase());
    return (
      <span className={`instrument-icon instrument-icon--${size} instrument-icon--monogram ${className}`} {...shared}>
        {/* El SVG lleva su propio `viewBox`, así que el texto escala con el
            disco y no hace falta calcular un tamaño de fuente por cada uso. */}
        <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
          <circle cx="20" cy="20" r="20" fill={`oklch(0.52 0.135 ${hue})`} />
          <circle cx="20" cy="20" r="19" fill="none" stroke={`oklch(0.72 0.14 ${hue})`} strokeWidth="1.4" opacity="0.55" />
          <text
            x="20"
            y="20.5"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={text.length >= 5 ? 11 : text.length === 4 ? 13 : text.length === 3 ? 15.5 : 18}
            fontWeight="680"
            letterSpacing="-0.5"
          >
            {text}
          </text>
        </svg>
      </span>
    );
  }

  return (
    <span
      className={`instrument-icon instrument-icon--${size} ${identity.secondary ? 'instrument-icon--pair' : ''} ${className}`}
      {...shared}
    >
      {/* SVG locales: sin rastreo, sin servicio remoto y sin depender de la red
          para que una lista de trescientas filas se vea completa. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={identity.src} alt="" width={40} height={40} decoding="async" loading="lazy" onError={() => setFailedSource(identity.src)} />
      {identity.secondary && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="instrument-icon-counter"
          src={identity.secondary}
          alt=""
          width={24}
          height={24}
          decoding="async"
          loading="lazy"
          onError={() => setFailedSource(identity.secondary!)}
        />
      )}
    </span>
  );
}
