'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Lock, Search, Star, X } from 'lucide-react';
import { ASSET_CLASS_LABEL, type AssetClass, type PlanId } from '@tl/types';
import { PLAN_ENTITLEMENTS, planAtLeast } from '@tl/types/plans';
import { AssetIcon } from '@/components/investment/AssetIcon';

/**
 * Cambiar de instrumento sin salir de la mesa.
 *
 * Antes el botón de la cabecera llevaba al explorador completo, y eso rompía la
 * sesión de trabajo: quien está siguiendo una posición y quiere mirar otra cosa
 * un momento no quiere cambiar de página, perder el gráfico y volver. Aquí se
 * abre una hoja encima, se elige y se sigue.
 *
 * El orden de lo que ofrece es el orden en que la gente lo necesita:
 *
 *   1. **Lo que ya sigue.** Si guardó instrumentos, están arriba y sin buscar.
 *   2. **Buscar.** Porque con trescientos instrumentos la lista completa no es
 *      un menú, y quien sabe lo que quiere lo escribe antes de leer nada.
 *   3. **Por familia.** Para el caso intermedio: sé que quiero una divisa, pero
 *      no cuál.
 *   4. **El explorador entero**, con su ficha y su detalle, para quien venía a
 *      investigar y no a cambiar.
 *
 * Lo que el plan no incluye también aparece, marcado. Esconderlo haría creer
 * que no existe; enseñarlo cerrado dice la verdad y deja decidir.
 */

export interface SwitcherInstrument {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  minPlan: PlanId;
  ticker?: string;
  /** Orden de reconocimiento. Cuanto más bajo, antes se enseña. */
  popularity?: number;
  /** Presente solo para lo que la persona ya sigue. */
  favorite?: boolean;
  price?: number;
  changePercent?: number;
  precision?: number;
}

const FAMILIES: Array<{ value: string; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'CRYPTO', label: 'Cripto' },
  { value: 'STOCK', label: 'Acciones' },
  { value: 'ETF', label: 'ETFs' },
  { value: 'FOREX', label: 'Divisas' },
  { value: 'INDEX', label: 'Índices' },
  { value: 'COMMODITY', label: 'Materias primas' },
];

/** Cuántos resultados se pintan de una vez. El resto llega al escribir. */
const VISIBLE = 40;

function score(item: SwitcherInstrument, q: string): number {
  const ticker = (item.ticker ?? item.symbol).toLowerCase();
  const symbol = item.symbol.toLowerCase();
  const name = item.name.toLowerCase();
  if (ticker === q || symbol === q) return 0;
  if (ticker.startsWith(q) || symbol.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (ticker.includes(q) || symbol.includes(q)) return 3;
  if (name.includes(q)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function InstrumentSwitcher({
  open,
  onClose,
  current,
  watchlist,
  catalog,
  plan,
}: {
  open: boolean;
  onClose: () => void;
  current: string;
  watchlist: SwitcherInstrument[];
  catalog: SwitcherInstrument[];
  plan: PlanId;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('ALL');
  const search = useRef<HTMLInputElement>(null);
  // `onClose` llega como una función nueva en cada render del padre, y el padre
  // se vuelve a pintar cada segundo con el pulso del mercado. Tenerla en las
  // dependencias del efecto hacía que el efecto se reejecutara una vez por
  // segundo y borrara el campo: escribir aquí era literalmente imposible.
  const close = useRef(onClose);
  close.current = onClose;

  // La hoja se pinta en el `body`, fuera del árbol de la terminal. Un diálogo a
  // pantalla completa no puede depender de que ningún ancestro tenga -hoy o
  // mañana- un `overflow`, un `transform` o un contexto de apilamiento propio:
  // cualquiera de los tres lo recorta o lo esconde, y eso no se ve venir hasta
  // que alguien lo reporta.
  useEffect(() => setMounted(true), []);

  // Solo al abrir. Nada de lo que pase después puede vaciar lo que se escribió.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setFamily('ALL');
    // El teclado del móvil tapando media hoja al abrir es peor que un toque de
    // más, así que el foco va al campo pero sin forzar el teclado en táctil.
    if (!matchMedia('(pointer: coarse)').matches) search.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const saved = useMemo(
    () => watchlist.filter((w) => !q || Number.isFinite(score(w, q))).slice(0, 12),
    [watchlist, q],
  );
  const results = useMemo(() => {
    const pool = catalog.filter((c) => family === 'ALL' || c.assetClass === family);
    if (!q) {
      // Sin búsqueda mandan dos cosas, en este orden: lo que se puede abrir
      // ahora mismo, y dentro de eso lo que la persona reconoce sin buscarlo.
      return pool
        .slice()
        .sort((a, b) => Number(planAtLeast(plan, b.minPlan)) - Number(planAtLeast(plan, a.minPlan))
          || (a.popularity ?? 9999) - (b.popularity ?? 9999)
          || a.symbol.localeCompare(b.symbol))
        .slice(0, VISIBLE);
    }
    return pool
      .map((c) => [c, score(c, q)] as const)
      .filter(([, rank]) => Number.isFinite(rank))
      .sort((a, b) => a[1] - b[1]
        || (a[0].popularity ?? 9999) - (b[0].popularity ?? 9999)
        || a[0].symbol.localeCompare(b[0].symbol))
      .slice(0, VISIBLE)
      .map(([c]) => c);
  }, [catalog, family, q, plan]);

  if (!open || !mounted) return null;

  function choose(item: SwitcherInstrument) {
    onClose();
    router.push(planAtLeast(plan, item.minPlan) ? `/terminal?symbol=${encodeURIComponent(item.symbol)}` : `/precios?desde=${encodeURIComponent(item.symbol)}`);
  }

  const row = (item: SwitcherInstrument, showQuote: boolean) => {
    const allowed = planAtLeast(plan, item.minPlan);
    return (
      <button
        key={item.symbol}
        type="button"
        className="switcher-row"
        data-current={item.symbol === current || undefined}
        data-locked={!allowed || undefined}
        onClick={() => choose(item)}
        aria-label={allowed ? `Cambiar a ${item.name}` : `${item.name}, incluido en el plan ${PLAN_ENTITLEMENTS[item.minPlan].name}`}
      >
        <AssetIcon symbol={item.symbol} assetClass={item.assetClass} ticker={item.ticker} name={item.name} size="sm" />
        <span className="switcher-identity">
          <strong>{item.ticker ?? item.symbol}</strong>
          <small>{item.name}</small>
        </span>
        {/* Una sola cosa a la derecha, no dos. El precio, el nombre de la
            familia y el candado compitiendo por el mismo hueco es lo que
            estrujaba la fila hasta cortar el nombre del instrumento. */}
        {!allowed ? (
          <span className="switcher-lock">
            <Lock size={13} aria-hidden="true" />
            {PLAN_ENTITLEMENTS[item.minPlan].name}
          </span>
        ) : showQuote && item.price != null ? (
          <span className="switcher-quote">
            <strong>{item.price.toLocaleString('en-US', { maximumFractionDigits: item.precision ?? 2 })}</strong>
            <small className={(item.changePercent ?? 0) < 0 ? 'simple-negative' : 'simple-positive'}>
              {(item.changePercent ?? 0) >= 0 ? '+' : ''}
              {(item.changePercent ?? 0).toFixed(2)} %
            </small>
          </span>
        ) : (
          <span className="switcher-class">{ASSET_CLASS_LABEL[item.assetClass]}</span>
        )}
      </button>
    );
  };

  return createPortal(
    <div className="switcher-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="switcher-sheet" role="dialog" aria-modal="true" aria-label="Cambiar de instrumento">
        <header className="switcher-head">
          <h2>Cambiar de instrumento</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>

        <label className="switcher-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Busca por nombre o ticker: oro, AAPL, euro…"
            aria-label="Buscar instrumento"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Borrar búsqueda">×</button>}
        </label>

        <div className="switcher-families" role="group" aria-label="Familia de mercado">
          {FAMILIES.map((item) => (
            <button key={item.value} type="button" aria-pressed={family === item.value} onClick={() => setFamily(item.value)}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="switcher-scroll">
          {!q && saved.length > 0 && (
            <section aria-label="Tu lista de seguimiento">
              <h3><Star size={13} aria-hidden="true" />Tu lista</h3>
              {saved.map((item) => row(item, true))}
            </section>
          )}

          <section aria-label={q ? 'Resultados de la búsqueda' : 'Mercados'}>
            <h3>{q ? `Resultados para "${query.trim()}"` : family === 'ALL' ? 'Todos los mercados' : FAMILIES.find((f) => f.value === family)!.label}</h3>
            {results.length > 0 ? (
              results.map((item) => row(item, false))
            ) : (
              <p className="switcher-empty">
                No encontramos ningún instrumento con ese nombre. Prueba con el ticker, o mira el catálogo completo.
              </p>
            )}
          </section>
        </div>

        <footer className="switcher-foot">
          <Link href="/explorar" onClick={onClose}>
            Ver los {catalog.length} mercados, con su ficha y su detalle <ArrowUpRight size={15} />
          </Link>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
