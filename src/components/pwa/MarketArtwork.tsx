'use client';

import { motion } from 'framer-motion';
import { useMotionPreference } from './useMotionPreference';
import { Logo } from '@/components/Logo';
import { AssetIcon } from '@/components/investment/AssetIcon';

/** Original TradingLab illustration. Not a price feed or an investment forecast. */
export function MarketArtwork({ scene = 0, compact = false }: { scene?: number; compact?: boolean }) {
  const reduce = useMotionPreference();
  return (
    <div className={`market-art ${compact ? 'market-art-compact' : ''}`} aria-hidden="true">
      <div className="market-art-halo" />
      <div className="market-art-orbit orbit-one" /><div className="market-art-orbit orbit-two" />
      <motion.div className="market-art-core" animate={{ rotate: reduce ? 0 : scene * 12 }} transition={{ type: 'spring', stiffness: 150, damping: 28 }}>
        <Logo withWordmark={false} size="lg" />
      </motion.div>
      <motion.div className="market-art-chart" animate={{ y: reduce ? 0 : scene === 1 ? -10 : 0, rotate: reduce ? 0 : scene === 2 ? -3 : 2 }} transition={{ type: 'spring', stiffness: 180, damping: 28 }}>
        <div className="art-card-heading"><span>EL VALOR DE ENTENDER</span><span>DEMO</span></div>
        <svg viewBox="0 0 300 108" fill="none">
          <path d="M4 26H296M4 54H296M4 82H296" stroke="currentColor" opacity=".12" />
          <path d="M6 72L28 63L51 76L73 44L94 53L119 34L141 60L163 47L185 61L208 35L230 43L253 21L277 30L294 18" stroke="#9ce7d3" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="294" cy="18" r="5" fill="#9ce7d3" />
        </svg>
        <div className="art-card-caption"><span>Observa. Pregunta. Aprende.</span><span>Ilustración</span></div>
      </motion.div>
      <div className="market-art-token token-bitcoin"><AssetIcon symbol="BTCUSD" size="lg" /></div>
      <div className="market-art-token token-lesson"><span>01</span><small>CRITERIO</small></div>
      <div className="market-art-note"><i />Aprender cambia tu perspectiva.</div>
    </div>
  );
}
