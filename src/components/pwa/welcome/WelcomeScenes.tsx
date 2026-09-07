'use client';

import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, BookOpen, ChevronRight, Compass, PencilLine, ShieldCheck, Sparkles } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { AssetIcon } from '@/components/investment/AssetIcon';
import { AssetOrbit } from './AssetOrbit';

const INSTRUMENTS = [
  { symbol: 'BTCUSD', name: 'Bitcoin', category: 'Cripto', description: 'Aprende qué mueve un mercado que nunca se detiene.', position: 'north' },
  { symbol: 'AAPL', name: 'Apple', category: 'Acciones', description: 'Conoce la relación entre una empresa y su acción.', position: 'east' },
  { symbol: 'EURUSD', name: 'Euro / dólar', category: 'Monedas', description: 'Explora cómo se relacionan dos economías.', position: 'south' },
  { symbol: 'ETHUSD', name: 'Ethereum', category: 'Cripto', description: 'Descubre otras ideas dentro del universo cripto.', position: 'west' },
] as const;

const spring = { type: 'spring' as const, stiffness: 200, damping: 28 };
const lift = (reduce: boolean, delay = 0) => ({ initial: reduce ? false as const : { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { ...spring, delay: reduce ? 0 : delay } });

/** Real asset identities; intentionally no made-up quotes, yields, or endorsements. */
/**
 * Escena 1. La constelación de instrumentos reales.
 *
 * Sustituye a las órbitas dibujadas y al logotipo suelto: aquellas eran formas
 * abstractas que podían ilustrar cualquier producto, y esto son las marcas que
 * la persona va a encontrar dentro. Reconocer Apple y Bitcoin en el primer
 * segundo dice qué es esto mejor que cualquier titular.
 */
export function MarketScene({ reduce }: { reduce: boolean }) {
  const [selected, setSelected] = useState(0);
  const instrument = INSTRUMENTS[selected];

  return (
    <section className="welcome-market-scene" aria-label="Explorador de instrumentos">
      <span className="welcome-art-label">
        <Compass size={14} /> ABRE TU MIRADA
      </span>

      <AssetOrbit reduce={reduce} />

      <div className="welcome-instrument-picker" role="group" aria-label="Toca un instrumento para descubrirlo">
        {INSTRUMENTS.map((item, index) => (
          <motion.button
            key={item.symbol}
            {...lift(reduce, 0.3 + index * 0.05)}
            type="button"
            onClick={() => setSelected(index)}
            aria-label={`Descubrir ${item.name}`}
            aria-pressed={selected === index}
            data-active={selected === index || undefined}
          >
            <AssetIcon symbol={item.symbol} size="sm" />
            <span>{item.name}</span>
          </motion.button>
        ))}
      </div>

      <motion.div className="welcome-market-caption" {...lift(reduce, 0.36)}>
        <div>
          <span>{instrument.category}</span>
          <strong>{instrument.name}</strong>
        </div>
        <p aria-live="polite" aria-atomic="true">
          {instrument.description}
        </p>
      </motion.div>
    </section>
  );
}

/** Trazados de la escena de práctica: neutro, al alza y a la baja. */
const NEUTRAL_PATH = 'M 12 120 C 34 120 34 105 56 110 S 87 134 109 115 S 137 86 160 98 S 188 116 209 99 S 239 78 262 91 S 285 105 306 91 S 325 86 338 86';
const UP_PATH = 'M 12 120 C 34 120 34 105 56 110 S 87 134 109 115 S 137 86 160 98 S 188 116 209 99 S 239 60 262 72 S 285 46 306 52 S 325 29 338 26';
const DOWN_PATH = 'M 12 120 C 34 120 34 105 56 110 S 87 134 109 115 S 137 86 160 98 S 188 116 209 99 S 239 138 262 124 S 285 148 306 135 S 325 160 338 160';

export function PracticeScene({ reduce }: { reduce: boolean }) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const gradient = useId().replace(/:/g, '');
  const path = direction === 'up' ? UP_PATH : direction === 'down' ? DOWN_PATH : NEUTRAL_PATH;
  const color = direction === 'down' ? '#bb4250' : '#126d55';
  return <section className="welcome-practice-scene" aria-label="Prueba interactiva, no crea una operación">
    <motion.div className="welcome-demo-balance" {...lift(reduce)}><span>UN ESPACIO PARA PRACTICAR</span><strong>10.000 <small>USD virtuales</small></strong><span className="welcome-demo-badge">DEMO</span></motion.div>
    <motion.div className="welcome-demo-terminal" {...lift(reduce, 0.08)}>
      <header><div><AssetIcon symbol="BTCUSD" /><span>Bitcoin <small>Ejemplo educativo</small></span></div><span className="welcome-example-tag">SIN DINERO REAL</span></header>
      <div className="welcome-demo-chart" data-demo-direction={direction ?? 'neutral'}>
        <span className="welcome-chart-label">Trayectoria hipotética</span>
        <svg viewBox="0 0 350 186" role="img" aria-label={direction === 'up' ? 'Ejemplo de un precio que sube' : direction === 'down' ? 'Ejemplo de un precio que baja' : 'Ejemplo de fluctuación de un precio'}>
          <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
          {[45, 90, 135, 180].map(y => <line key={y} x1="8" y1={y} x2="342" y2={y} stroke="#14362e12" strokeDasharray="3 5" />)}
          <motion.path d={`${path} L 338 185 L 12 185 Z`} animate={{ d: `${path} L 338 185 L 12 185 Z` }} transition={{ duration: reduce ? 0 : 0.45, ease: 'easeOut' }} fill={`url(#${gradient})`} />
          <motion.path d={path} animate={{ d: path, stroke: color }} initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: reduce ? 0 : 0.6, ease: 'easeOut' }} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <motion.circle cx="338" cy="86" r="4.5" animate={{ cy: direction === 'up' ? 26 : direction === 'down' ? 160 : 86, fill: color }} transition={{ duration: reduce ? 0 : 0.45 }} />
        </svg>
      </div>
      <div className="welcome-demo-actions" role="group" aria-label="Explorar un escenario hipotético">
        <button type="button" className="welcome-demo-up" aria-pressed={direction === 'up'} onClick={() => setDirection('up')}><ArrowUpRight size={21} />Subir</button>
        <button type="button" className="welcome-demo-down" aria-pressed={direction === 'down'} onClick={() => setDirection('down')}><ArrowDownRight size={21} />Bajar</button>
      </div>
      <p className="welcome-demo-response" aria-live="polite">{direction === 'up' ? 'Si sube: un escenario, no una operación.' : direction === 'down' ? 'Si baja: un escenario, no una operación.' : 'Toca una dirección. No es una operación.'}</p>
    </motion.div>
    <motion.div className="welcome-risk-chip" {...lift(reduce, 0.17)}><ShieldCheck size={17} /><strong>Define tu límite antes de operar.</strong></motion.div>
  </section>;
}

export function LearningScene({ reduce }: { reduce: boolean }) {
  const [reflection, setReflection] = useState<'observe' | 'learn'>('observe');
  return <section className="welcome-learning-scene" aria-label="De aprender a reflexionar">
    <div className="welcome-learning-grid" aria-hidden="true" />
    <motion.div className="welcome-academy-label" {...lift(reduce)}><Sparkles size={15} /><span>UN MÉTODO, NO UN ATAJO.</span></motion.div>
    <svg className="welcome-learning-thread" viewBox="0 0 420 400" fill="none" aria-hidden="true"><motion.path d="M 330 45 C 365 138 46 72 72 172 S 365 160 330 271 S 134 263 172 370" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduce ? 0 : 1.2, ease: 'easeOut' }} /></svg>
    <motion.div className="welcome-lesson-ticket" {...lift(reduce, 0.06)}>
      <span className="welcome-ticket-icon"><BookOpen size={24} /></span><div><span>01 · ENTIENDE</span><strong>El riesgo también<br />se aprende.</strong><small>Academia TradingLab <ChevronRight size={12} /></small></div>
      <span className="welcome-ticket-cut" aria-hidden="true" />
    </motion.div>
    <motion.div className="welcome-practice-ticket" {...lift(reduce, 0.13)}><span className="welcome-ticket-icon"><ShieldCheck size={19} /></span><div><span>02 · PONLO A PRUEBA</span><strong>Una idea. Un límite.</strong></div></motion.div>
    <motion.div className="welcome-journal-ticket" {...lift(reduce, 0.2)}>
      <header><PencilLine size={18} /><span>03 · DIARIO</span><span className="welcome-journal-example">VISTA PREVIA</span></header>
      <div className="welcome-journal-tabs" role="group" aria-label="Pregunta para tu diario">
        <button type="button" aria-pressed={reflection === 'observe'} onClick={() => setReflection('observe')}>Lo que observé</button>
        <button type="button" aria-pressed={reflection === 'learn'} onClick={() => setReflection('learn')}>Lo que aprendí</button>
      </div>
      <p aria-live="polite">{reflection === 'observe' ? '¿Qué viste en el gráfico antes de tomar una decisión?' : '¿Qué harías diferente la próxima vez?'}</p>
      <div className="welcome-journal-lines" aria-hidden="true"><span /><span /></div>
    </motion.div>
  </section>;
}
