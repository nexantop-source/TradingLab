/**
 * Marca de la red de tarjetas.
 *
 * Se dibuja con formas propias en lugar de incrustar los logotipos oficiales:
 * identifican la red igual de bien, no dependen de descargar un activo de
 * terceros y evitan reproducir una marca registrada píxel a píxel. Su función
 * aquí es que la persona reconozca de un vistazo cuál de sus tarjetas guardó,
 * no representar comercialmente a la red.
 *
 * La marca la deduce el servidor a partir del BIN, así que este componente
 * nunca decide nada: solo pinta lo que ya se resolvió.
 */
export function CardBrand({ brand, className }: { brand: string | null; className?: string }) {
  const key = (brand ?? '').toLowerCase();
  const common = {
    width: 38,
    height: 24,
    viewBox: '0 0 38 24',
    className,
    role: 'img' as const,
    'aria-label': brand ? `Tarjeta ${brand}` : 'Tarjeta',
  };
  const frame = (
    <rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="var(--color-surface)" stroke="var(--color-border-strong)" />
  );

  if (key.includes('visa')) {
    return (
      <svg {...common}>
        {frame}
        <text
          x="19"
          y="16.5"
          textAnchor="middle"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="11"
          fontStyle="italic"
          fontWeight="700"
          letterSpacing="0.5"
          fill="#1a1f71"
        >
          VISA
        </text>
      </svg>
    );
  }

  if (key.includes('master')) {
    return (
      <svg {...common}>
        {frame}
        <circle cx="15.5" cy="12" r="6.4" fill="#eb001b" />
        <circle cx="22.5" cy="12" r="6.4" fill="#f79e1b" />
        {/* La intersección es lo que hace reconocible la marca. */}
        <path
          d="M19 6.9a6.4 6.4 0 0 0 0 10.2 6.4 6.4 0 0 0 0-10.2Z"
          fill="#ff5f00"
        />
      </svg>
    );
  }

  if (key.includes('american') || key.includes('amex')) {
    return (
      <svg {...common}>
        <rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#2e77bc" stroke="#2e77bc" />
        <text
          x="19"
          y="15.5"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="8"
          fontWeight="700"
          letterSpacing="0.6"
          fill="#ffffff"
        >
          AMEX
        </text>
      </svg>
    );
  }

  if (key.includes('diners')) {
    return (
      <svg {...common}>
        {frame}
        <circle cx="15.5" cy="12" r="6.2" fill="#0079be" />
        <circle cx="22.5" cy="12" r="6.2" fill="#0079be" />
        <circle cx="19" cy="12" r="3.4" fill="var(--color-surface)" />
      </svg>
    );
  }

  if (key.includes('discover')) {
    return (
      <svg {...common}>
        {frame}
        <path d="M4 19h30a4 4 0 0 0 3.5-2.2V19a4 4 0 0 1-4 4H4Z" fill="none" />
        <circle cx="27" cy="12" r="5" fill="#f76e11" />
        <text
          x="14"
          y="15.5"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          fontSize="7"
          fontWeight="700"
          fill="var(--color-text)"
        >
          DISC
        </text>
      </svg>
    );
  }

  // Marca desconocida: una tarjeta genérica dice la verdad mejor que inventar
  // una red que no sabemos cuál es.
  return (
    <svg {...common}>
      {frame}
      <rect x="4" y="7.5" width="30" height="2.5" rx="1.25" fill="var(--color-border-strong)" />
      <rect x="4" y="14" width="11" height="2.5" rx="1.25" fill="var(--color-border)" />
    </svg>
  );
}
