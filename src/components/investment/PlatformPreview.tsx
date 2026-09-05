'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Compass, LayoutDashboard, Layers3, GraduationCap, WalletCards, Search } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { FluidControl } from './FluidControl';
import { AssetIcon } from './AssetIcon';

export interface PreviewSample { symbol: string; name: string; price: number; change: number; values: number[]; synthetic: boolean; source: string; precision: number }
export function PlatformPreview({ samples }: { samples: PreviewSample[] }) {
  const [active, setActive] = useState(samples[0].symbol);
  const [range, setRange] = useState('48');
  const selected = samples.find(s => s.symbol === active)!;
  const data = selected.values.slice(-Number(range));
  const min = Math.min(...data), max = Math.max(...data);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 720},${210 - ((v - min) / (max - min || 1)) * 175}`).join(' ');
  const id = useId().replace(/:/g, '');
  return <div className="invest-preview" aria-label="Vista interactiva de la plataforma">
    <aside className="invest-preview-sidebar"><Logo size="sm" /><div>{[[LayoutDashboard, 'Resumen', '/panel'], [Compass, 'Explorar', '/mercados'], [Layers3, 'Trading', '/terminal'], [WalletCards, 'Portafolio', '/portafolio'], [GraduationCap, 'Academia', '/academia']].map(([Icon, label, href]) => { const I = Icon as typeof Compass; return <Link className={label === 'Trading' ? 'active' : ''} href={String(href)} key={String(label)}><I size={17} />{String(label)}</Link>; })}</div><span className="invest-preview-account"><span>Tu espacio para practicar</span><b>Cuenta DEMO</b></span></aside>
    <div className="invest-preview-main"><div className="invest-preview-top"><span>Tu espacio de trading</span><Link href="/mercados" aria-label="Buscar mercados"><Search size={16} /></Link><span className="invest-demo-chip">DEMO</span></div>
      <div className="invest-preview-tabs">{samples.map(s => <button key={s.symbol} aria-pressed={active === s.symbol} onClick={() => setActive(s.symbol)}><AssetIcon symbol={s.symbol} size="sm" /><strong>{s.symbol}</strong><small className={s.change < 0 ? 'down' : ''}>{s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</small></button>)}</div>
      <div className="invest-preview-body"><div className="invest-preview-chart"><div className="invest-preview-asset"><div><span>{selected.name}</span><h2>{selected.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: selected.precision })}<small> USD</small></h2><span className="invest-preview-source">{selected.synthetic ? 'Precio simulado · DEMO' : selected.source}</span></div><Link href={`/terminal?symbol=${active}`} aria-label={`Abrir ${active} en la terminal`}><ArrowUpRight size={21} /></Link></div>
        <svg viewBox="0 0 720 240" className="invest-line-chart" role="img" aria-label={`Serie ${selected.synthetic ? 'simulada' : selected.source} de ${selected.symbol}, últimas ${range} velas de una hora`}>
          <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3478f6" stopOpacity=".2" /><stop offset="100%" stopColor="#3478f6" stopOpacity="0" /></linearGradient></defs>
          {[35, 90, 145, 210].map(y => <line key={y} x1="0" x2="720" y1={y} y2={y} stroke="currentColor" opacity=".06" />)}
          <polygon points={`0,240 ${points} 720,240`} fill={`url(#${id})`} /><polyline points={points} fill="none" stroke="#3478f6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="invest-preview-chart-footer"><FluidControl label="Velas de una hora visibles" options={[{value:'24',label:'24 velas'},{value:'48',label:'48 velas'},{value:'90',label:'90 velas'}]} value={range} onChange={setRange} /><span>Intervalo 1 h</span></div>
      </div><aside className="invest-preview-ticket"><span className="invest-eyebrow">TU SIGUIENTE DECISIÓN</span><h3>Empieza con una idea.</h3><p>Define tu posición con contexto y con un límite de riesgo.</p><dl><div><dt>Cuenta</dt><dd>DEMO</dd></div><div><dt>Instrumento</dt><dd>{active}</dd></div><div><dt>Saldo inicial virtual</dt><dd>USD 10.000</dd></div></dl><Link href={`/terminal?symbol=${active}`} className="invest-button">Practicar <ArrowUpRight size={15} /></Link><small>El simulador usa dinero virtual.</small></aside></div>
    </div>
  </div>;
}
