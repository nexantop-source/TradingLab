'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, ArrowUpRight, Search, Star, ChevronRight } from 'lucide-react';
import { ASSET_CLASS_LABEL, type AssetClass, type MarketStatus, type PlanId } from '@tl/types';
import { PLAN_ENTITLEMENTS, planAtLeast } from '@tl/types/plans';
import { Modal } from '@tl/ui';
import { apiFetch } from '@/lib/client-api';
import { FluidControl } from './FluidControl';
import { AssetIcon } from './AssetIcon';
export { AssetIcon } from './AssetIcon';

export interface ExplorerAsset {
  symbol: string; name: string; assetClass: AssetClass; precision: number; currency: string;
  description: string; risk: number; minPlan: PlanId; session: string; price: number | null;
  change: number | null; synthetic: boolean; source: string; timestamp: number;
  /** Ticker que ve la persona. Difiere del interno cuando se cotiza por un fondo. */
  ticker?: string;
  marketStatus?: MarketStatus;
}
export function MarketExplorer({ assets, authenticated = false, initialWatchlist = [], plan = 'FREE' }: {
  assets: ExplorerAsset[]; authenticated?: boolean; initialWatchlist?: string[]; plan?: PlanId;
}) {
  const [category, setCategory] = useState('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('name');
  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [selected, setSelected] = useState<ExplorerAsset | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [limit, setLimit] = useState(20);
  const filtered = useMemo(() => assets.filter(a => (category === 'ALL' || category === 'SAVED' ? category !== 'SAVED' || watchlist.includes(a.symbol) : a.assetClass === category) && `${a.ticker ?? a.symbol} ${a.symbol} ${a.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === 'change' ? (b.change ?? -Infinity) - (a.change ?? -Infinity) : a.symbol.localeCompare(b.symbol)), [assets, category, query, sort, watchlist]);
  async function toggleWatch(asset: ExplorerAsset) {
    if (!authenticated) { setMessage('Inicia sesión para guardar tu lista y verla en todos tus dispositivos.'); return; }
    setBusy(asset.symbol);
    try {
      const exists = watchlist.includes(asset.symbol);
      await apiFetch('/api/watchlist', { method: 'POST', json: { symbol: asset.symbol, action: exists ? 'REMOVE' : 'ADD' } });
      setWatchlist(v => exists ? v.filter(s => s !== asset.symbol) : [...v, asset.symbol]);
      setMessage(`${asset.symbol} ${exists ? 'eliminado de' : 'añadido a'} tu seguimiento.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'No se pudo guardar. Inténtalo de nuevo.'); }
    finally { setBusy(null); }
  }
  return <div className="invest-explorer">
    <div className="invest-explorer-tools"><label className="invest-search"><Search size={18} aria-hidden="true" /><input aria-label="Buscar activos" placeholder="Busca un ETF, una moneda o una empresa" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda">×</button>}</label><label className="invest-sort"><ArrowDownUp size={16} /><select aria-label="Ordenar activos" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Símbolo A–Z</option><option value="change">Mayor variación</option></select></label></div>
    <FluidControl label="Categoría de mercado" value={category} onChange={v => { setCategory(v); setLimit(20); }} options={[{ value: 'ALL', label: 'Todos' }, { value: 'ETF', label: 'ETFs' }, { value: 'CRYPTO', label: 'Cripto' }, { value: 'FOREX', label: 'Divisas' }, { value: 'STOCK', label: 'Acciones' }, { value: 'INDEX', label: 'Índices' }, { value: 'COMMODITY', label: 'Materias primas' }, { value: 'SAVED', label: 'Mi lista' }]} />
    <div className="invest-list-caption"><span>{filtered.length} instrumentos</span><span>{assets.every(a => a.synthetic) ? 'Precios simulados · no son cotizaciones reales' : 'Consulta la fuente de cada instrumento'}</span></div>
    {message && <div className="invest-feedback" role="status">{message}{!authenticated && <Link href="/entrar"> Iniciar sesión →</Link>}<button onClick={() => setMessage('')} aria-label="Cerrar mensaje">×</button></div>}
    <div className="invest-market-table"><div className="invest-market-head"><span>Instrumento</span><span>Precio de referencia</span><span>Variación de la sesión</span><span>Mercado</span><span>Seguimiento</span></div>
      {filtered.slice(0, limit).map(a => <div className="invest-market-row" key={a.symbol}>
        <button className="invest-asset-name" onClick={() => setSelected(a)}><AssetIcon {...a} /><span><strong>{a.symbol}</strong><small>{a.name}</small></span></button>
        <span className="invest-quote">{a.price == null ? 'No disponible' : a.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: a.precision })}<small>{a.currency} · {a.synthetic ? 'DEMO' : a.source}</small></span>
        <span className={`invest-change ${(a.change ?? 0) < 0 ? 'down' : ''}`}>{a.change == null ? '—' : `${a.change >= 0 ? '+' : ''}${a.change.toFixed(2)}%`}</span>
        <span className="invest-market-class">{ASSET_CLASS_LABEL[a.assetClass]}</span>
        <button className="invest-watch" disabled={busy !== null} onClick={() => toggleWatch(a)} aria-label={`${watchlist.includes(a.symbol) ? 'Quitar' : 'Seguir'} ${a.symbol}`} aria-pressed={watchlist.includes(a.symbol)}><Star size={18} fill={watchlist.includes(a.symbol) ? 'currentColor' : 'none'} /></button>
      </div>)}
      {!filtered.length && <div className="invest-empty"><Search size={28} /><h3>{category === 'SAVED' ? 'Tu lista empieza aquí.' : 'No encontramos ese instrumento.'}</h3><p>{category === 'SAVED' ? 'Guarda activos con la estrella para encontrarlos rápidamente.' : 'Prueba otro símbolo o explora las categorías disponibles.'}</p><button className="invest-text-link" onClick={() => { setCategory('ALL'); setQuery(''); }}>Explorar todos <ChevronRight size={16} /></button></div>}
    </div>
    {filtered.length > limit && <button className="invest-button secondary invest-load-more" onClick={() => setLimit(v => v + 20)}>Ver más instrumentos</button>}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? 'Instrumento'} size="md">
      {selected && <div className="invest-asset-detail"><div className="invest-detail-heading"><AssetIcon {...selected} /><div><strong>{selected.symbol}</strong><small>{ASSET_CLASS_LABEL[selected.assetClass]}</small></div></div><p>{selected.description}</p><dl><div><dt>Precio de referencia</dt><dd>{selected.price?.toLocaleString('en-US', { maximumFractionDigits: selected.precision }) ?? 'No disponible'} {selected.currency}</dd></div><div><dt>Riesgo educativo</dt><dd>{selected.risk} de 5</dd></div><div><dt>Fuente</dt><dd>{selected.source}</dd></div><div><dt>Actualización (UTC)</dt><dd>{new Date(selected.timestamp).toISOString().replace('T', ' ').slice(0, 19)}</dd></div></dl><p className="invest-detail-note">{selected.session}. Horario orientativo. {selected.synthetic && 'Esta serie es sintética y no representa el precio actual del activo.'}</p><Link className="invest-button" href={planAtLeast(plan, selected.minPlan) ? `/terminal?symbol=${selected.symbol}` : '/precios'}>{planAtLeast(plan, selected.minPlan) ? 'Abrir en trading DEMO' : `Ver plan ${PLAN_ENTITLEMENTS[selected.minPlan].name}`}<ArrowUpRight size={16} /></Link></div>}
    </Modal>
  </div>;
}
