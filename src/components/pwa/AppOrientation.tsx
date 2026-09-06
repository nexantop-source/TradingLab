'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronLeft, Compass } from 'lucide-react';
import { LearningSculpture } from './LearningSculpture';
import { useMotionPreference } from './useMotionPreference';
import { isStandalone } from './appMode';
import { useTheme } from '@tl/ui/ThemeProvider';

const KEY = 'tl-app-orientation:v1';
let seenInMemory = false;
const STEPS = [
  { label: 'ENTIENDE', title: 'Primero,\ntu criterio.', body: 'No necesitas saberlo todo para empezar. En Aprende encontrarás lecciones breves y una ruta para avanzar a tu ritmo.', detail: 'Tu progreso se guarda en tu cuenta.', number: '01' },
  { label: 'EXPERIMENTA', title: 'Ideas reales.\nDinero virtual.', body: 'En Practicar puedes explorar gráficos y probar tus ideas con saldo demo. Cada decisión es una oportunidad de aprender.', detail: 'Sin depósitos. El saldo virtual no se puede retirar.', number: '02' },
  { label: 'HAZLO TUYO', title: 'Tu espacio.\nTu siguiente paso.', body: 'Vuelve a Inicio para retomar una lección o revisar tu actividad. Explore es tu acceso gratuito cuando no tienes un plan de pago.', detail: 'Plus y Pro son opcionales. No necesitas una tarjeta para empezar.', number: '03' },
];

/** Presentation-only tour. Does not change onboarding consent, billing or entitlements. */
export function AppOrientation() {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const systemReduce = useMotionPreference();
  const { reduceMotion } = useTheme();
  const reduce = systemReduce || reduceMotion;
  const item = STEPS[step];
  useEffect(() => {
    if (!isStandalone() || !window.matchMedia('(max-width: 1023px)').matches || seenInMemory) return;
    try { if (localStorage.getItem(KEY) === 'seen') return; } catch { /* Dismissible with blocked storage. */ }
    setOpen(true);
  }, []);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    if (!element) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previousOverflow; };
  }, [open]);
  useEffect(() => { if (open) heading.current?.focus({ preventScroll: true }); }, [open, step]);
  function finish(restoreFocus = true) {
    seenInMemory = true;
    try { localStorage.setItem(KEY, 'seen'); } catch { /* In-memory fallback for this visit. */ }
    dialog.current?.close();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }
  return <>
    <button ref={trigger} className="native-tour-trigger" onClick={() => { setStep(0); setOpen(true); }}><Compass size={17} aria-hidden="true" />Conoce tu app<ArrowRight size={16} aria-hidden="true" /></button>
    <dialog ref={dialog} className="native-orientation" aria-labelledby="orientation-title" aria-describedby="orientation-description" onCancel={event => { event.preventDefault(); finish(); }}>
      <div className="orientation-content">
        <header className="orientation-header"><span>TradingLab <small>· {step + 1} de {STEPS.length}</small></span><button onClick={() => finish()}>Omitir</button></header>
        <div className="orientation-art"><LearningSculpture scene={step} /><span className="orientation-number" aria-hidden="true">{item.number}</span></div>
        <motion.section key={step} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 30 }} className="orientation-copy">
          <span className="native-kicker">{item.label}</span>
          <h1 id="orientation-title" ref={heading} tabIndex={-1}>{item.title}</h1>
          <p id="orientation-description">{item.body}</p>
          <p className="orientation-detail">{item.detail}</p>
        </motion.section>
        <footer className="orientation-footer">
          <div className="orientation-progress" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>{STEPS.map((s, i) => <span key={s.label} data-current={i === step} />)}</div>
          <div className="orientation-actions">
            {step > 0 && <button className="orientation-back" aria-label="Paso anterior" onClick={() => setStep(step - 1)}><ChevronLeft size={22} /></button>}
            {step < STEPS.length - 1 ? <button className="native-primary-button" onClick={() => setStep(step + 1)}>Continuar<ArrowRight size={19} /></button> : <Link className="native-primary-button" href="/academia" onClick={() => finish(false)}>Empezar a aprender<ArrowRight size={19} /></Link>}
          </div>
          {step === STEPS.length - 1 && <button className="orientation-later" onClick={() => finish()}>Explorar mi inicio</button>}
        </footer>
      </div>
    </dialog>
  </>;
}
