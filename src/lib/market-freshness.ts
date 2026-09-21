import type { DataFreshness, MarketStatus } from '@tl/types';

/** A snapshot is never described as a streaming connection. */
export function marketSnapshotLabel(asset: { synthetic: boolean; timestamp: number; freshness?: DataFreshness; marketStatus?: MarketStatus }, now?: number): string {
  if (asset.synthetic) return 'Serie simulada';
  if ((asset.marketStatus !== undefined && asset.marketStatus !== 'OPEN') || asset.freshness === 'MARKET_CLOSED') return 'Mercado cerrado · última referencia';
  if (asset.freshness === 'STALE') return 'Dato desactualizado';
  if (asset.freshness === 'DELAYED') return 'Dato diferido';
  if (now !== undefined && (!Number.isFinite(asset.timestamp) || now - asset.timestamp > 90_000)) return 'Dato desactualizado';
  if (asset.freshness === 'REALTIME') return 'Muestra reciente · al consultar';
  return 'Precio de referencia';
}
