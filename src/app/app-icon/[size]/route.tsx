import { ImageResponse } from 'next/og';

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: input } = await params;
  if (!['180', '192', '512'].includes(input)) return new Response('Not found', { status: 404 });
  const size = Number(input);
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', background: '#0c1825', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size * 0.6} height={size * 0.64} viewBox="100 70 800 860" fill="#c3f3e1">
        <path d="M180 390 C180 360 195 335 220 318 L548 100 C580 79 620 101 620 140 L620 300 C620 324 610 345 590 360 L500 405 L395 500 L240 615 C214 633 180 615 180 583 Z M500 405 L605 500 L617 491 L518 396 Z" />
        <path d="M820 610 C820 640 805 665 780 682 L452 900 C420 921 380 899 380 860 L380 700 C380 676 390 655 410 640 L500 595 L605 500 L760 385 C786 367 820 385 820 417 Z M500 595 L395 500 L383 509 L482 604 Z" />
      </svg>
    </div>, { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=86400' } },
  );
}
