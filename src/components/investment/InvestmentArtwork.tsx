import Image from 'next/image';

/** Decorative editorial art. Content and market data always remain real HTML. */
export function InvestmentArtwork({ scene, priority = false, sizes = '100vw' }: {
  scene: 'horizon' | 'possibilities' | 'learning';
  priority?: boolean;
  sizes?: string;
}) {
  return <Image src={`/assets/visuals/${scene}-v1.webp`} alt="" fill
    className="investment-artwork" sizes={sizes} priority={priority} />;
}
