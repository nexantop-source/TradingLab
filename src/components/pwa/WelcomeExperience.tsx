'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { useMotionPreference } from './useMotionPreference';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { MarketScene, PracticeScene, LearningScene } from './welcome/WelcomeScenes';
import { InstallApp } from './InstallApp';

const SCENES = [
  { eyebrow: '01 / DESCUBRE', title: 'Un mundo de mercados.\nTu propia mirada.', text: 'Cripto, acciones y monedas. Conoce qué hay detrás de cada movimiento antes de dar el siguiente paso.', tag: 'Explora los mercados', name: 'markets' },
  { eyebrow: '02 / PRUEBA', title: 'Menos dudas.\nMás práctica.', text: 'Un importe virtual. Una dirección. Un límite. Aprende a plantear una operación sin arriesgar tu dinero.', tag: 'Prueba una idea', name: 'practice' },
  { eyebrow: '03 / EVOLUCIONA', title: 'No colecciones señales.\nConstruye criterio.', text: 'Conecta lo que aprendes con lo que haces. Lecciones, práctica y un diario para entender tus decisiones.', tag: 'Construye tu criterio', name: 'learning' },
];

export function WelcomeExperience() {
  const [scene, setScene] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduce = useMotionPreference();
  const drag = useDragControls();
  const current = SCENES[scene];
  function goTo(index: number) {
    const target = Math.max(0, Math.min(SCENES.length - 1, index));
    setDirection(target >= scene ? 1 : -1);
    setScene(target);
  }
  return (
    <main id="contenido" className="ios-welcome welcome-app" data-welcome-scene={current.name}>
      <header className="welcome-topbar"><Link href="/" aria-label="TradingLab, inicio"><Logo /></Link><Link href="/entrar" className="welcome-signin">Entrar <ArrowRight size={15} /></Link></header>
      <div className="welcome-composition">
        <motion.div className="welcome-stage" drag={reduce ? false : 'x'} dragControls={drag} dragListener={false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.13} dragTransition={{ bounceStiffness: 380, bounceDamping: 34 }}
          onPointerDown={event => { if (!(event.target as HTMLElement).closest('button, a, input, select, textarea')) drag.start(event); }}
          onDragEnd={(_, info) => { const projected = info.offset.x + info.velocity.x * 0.1; if (Math.abs(projected) > 65) goTo(scene + (projected < 0 ? 1 : -1)); }} style={{ touchAction: 'pan-y' }}>
          <AnimatePresence initial={false} mode="popLayout" custom={direction}>
            <motion.div key={current.name} className="welcome-scene-art" data-scene={current.name} custom={direction}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 34, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction * -24, scale: 0.98 }} transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 260, damping: 32 }}>
              {scene === 0 ? <MarketScene reduce={reduce} /> : scene === 1 ? <PracticeScene reduce={reduce} /> : <LearningScene reduce={reduce} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>
        <section className="welcome-content" aria-label="Descubre TradingLab">
          <div className="welcome-story" aria-live="polite" aria-atomic="true">
            <span className="welcome-eyebrow">{current.eyebrow}</span>
            <motion.div key={current.name} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 32 }}>
              <h1>{current.title}</h1><p>{current.text}</p>
            </motion.div>
          </div>
          <nav className="welcome-navigation" aria-label="Presentación de TradingLab">
            <button type="button" disabled={scene === 0} onClick={() => goTo(scene - 1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
            <div className="welcome-progress">{SCENES.map((item, index) => <button key={item.name} type="button" onClick={() => goTo(index)} aria-label={`Pantalla ${index + 1}: ${item.tag}`} aria-current={index === scene ? 'step' : undefined}><span /></button>)}</div>
            <button type="button" disabled={scene === SCENES.length - 1} onClick={() => goTo(scene + 1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
          </nav>
          <Link href="/crear-cuenta" className="welcome-create">Empezar gratis <ArrowRight size={18} /></Link>
          <p className="welcome-account-note">Explore incluido. Sin tarjeta ni depósitos.</p>
          <InstallApp />
        </section>
      </div>
      <footer className="welcome-legal"><span>Educación y simulación · No es un broker</span><div><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/terminos">Términos</Link></div></footer>
    </main>
  );
}
