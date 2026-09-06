import { Logo } from '@/components/Logo';

/** Original brand sculpture, purely decorative. It is not a financial chart. */
export function LearningSculpture({ scene = 0 }: { scene?: number }) {
  return <div className="learning-sculpture" data-scene={scene} aria-hidden="true">
    <div className="learning-sculpture-orbit" />
    <div className="learning-sculpture-layer layer-back" />
    <div className="learning-sculpture-layer layer-middle" />
    <div className="learning-sculpture-layer layer-front"><Logo size="lg" withWordmark={false} /></div>
    <span className="learning-sculpture-satellite satellite-one" />
    <span className="learning-sculpture-satellite satellite-two" />
  </div>;
}
