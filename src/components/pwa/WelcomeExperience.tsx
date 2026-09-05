'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useMotionPreference } from './useMotionPreference';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { MarketArtwork } from './MarketArtwork';
import { InstallApp } from './InstallApp';

const SCENES = [
  { eyebrow: 'TU LABORATORIO, CONTIGO', title: 'El mercado cambia.\nTu criterio crece.', text: 'Un espacio para entender los mercados, practicar con calma y aprender de cada decisión.', tag: 'Aprende primero' },
  { eyebrow: 'ESPACIO PARA EQUIVOCARTE', title: 'Practica sin poner\ntu dinero en juego.', text: 'Empieza con USD 10.000 virtuales. Explora gráficos, plantea una idea y observa qué sucede.', tag: 'Cuenta DEMO incluida' },
  { eyebrow: 'PEQUEÑOS PASOS. MÁS CLARIDAD.', title: 'Construye tu propia\nforma de entender.', text: 'Lecciones, un diario de decisiones y un tutor educativo. Tu siguiente paso empieza por comprender.', tag: 'A tu ritmo' },
];

export function WelcomeExperience() {
  const [scene, setScene] = useState(0);
  const reduce = useMotionPreference();
  const current = SCENES[scene];
  const move = (direction: number) => setScene(value => Math.max(0, Math.min(SCENES.length - 1, value + direction)));
  return (
    <main id="contenido" className="ios-welcome">
      <header className="ios-welcome-header"><Link href="/" aria-label="TradingLab, inicio"><Logo /></Link><Link href="/entrar" className="glass-link">Iniciar sesión <ArrowRight size={15} /></Link></header>
      <div className="ios-welcome-layout">
        <motion.div className="ios-welcome-art" drag={reduce ? false : 'x'} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.12}
          onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 45 || Math.abs(info.velocity.x) > 350) move(info.offset.x + info.velocity.x * 0.08 < 0 ? 1 : -1); }} style={{ touchAction: 'pan-y' }}>
          <MarketArtwork scene={scene} />
        </motion.div>
        <section className="ios-welcome-copy" aria-label="Descubre TradingLab">
          <span className="ios-eyebrow">{current.eyebrow}</span>
          <motion.div key={scene} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 210, damping: 30 }} aria-live="polite" aria-atomic="true">
            <h1>{current.title}</h1><p className="ios-welcome-description">{current.text}</p>
          </motion.div>
          <div className="ios-scene-controls">
            <button type="button" disabled={scene === 0} onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
            <div className="ios-scene-dots">{SCENES.map((item, index) => <button key={item.eyebrow} type="button" onClick={() => setScene(index)} aria-label={`Pantalla ${index + 1}: ${item.tag}`} aria-current={index === scene ? 'step' : undefined}><span /></button>)}</div>
            <button type="button" disabled={scene === SCENES.length - 1} onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
          </div>
          <Link href="/crear-cuenta" className="ios-primary-action">Crear mi espacio gratis <ArrowRight size={18} /></Link>
          <p className="ios-welcome-fineprint">Sin tarjeta. Sin depósitos. Solo posibilidades de aprender.</p>
          <InstallApp />
        </section>
      </div>
      <footer className="ios-welcome-footer"><span>Educación y simulación · No es un broker</span><Link href="/legal/privacidad">Privacidad</Link><Link href="/legal/terminos">Términos</Link></footer>
    </main>
  );
}
