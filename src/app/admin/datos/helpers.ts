import { ASSET_CLASS_LABEL, type AssetClass } from '@tl/types';

export { listProviders, marketData, SYMBOLS } from '@tl/market-data';

/** Etiqueta de clase de activo tolerante a valores desconocidos. */
export function ASSET_CLASS_LABEL_SAFE(value: string): string {
  return ASSET_CLASS_LABEL[value as AssetClass] ?? value;
}
