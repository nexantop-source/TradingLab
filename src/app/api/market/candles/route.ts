import { NextRequest } from 'next/server';
import { z } from 'zod';
import { clientIp, handleError, ok } from '@/lib/api';
import { enforce, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuth } from '@/lib/auth';
import { marketData, requireSymbol, computeIndicators, snapshotIndicators } from '@tl/market-data';
import { filterIndicators } from '@/lib/entitlements';
import { TIMEFRAMES, type IndicatorId } from '@tl/types';

const querySchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.enum(TIMEFRAMES).default('1h'),
  // El techo alto es deliberado: una serie semanal completa de una accion con
  // cuarenta anos de historia son mas de dos mil velas, y recortarlas seria
  // volver a ensenar un trozo del pasado en lugar del pasado.
  limit: z.coerce.number().int().min(20).max(5000).default(300),
  indicators: z.string().optional(),
});

/**
 * Serie histórica con indicadores calculados en el servidor.
 *
 * Los indicadores se calculan aquí, no en el navegador, por dos motivos: el
 * resultado es idéntico para todos los usuarios y auditable, y es exactamente
 * el mismo cálculo que alimenta al entrenador de IA.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    await enforce(`candles:${auth?.user.id ?? clientIp(req) ?? 'anon'}`, RATE_LIMITS.marketData);

    const params = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const meta = requireSymbol(params.symbol);

    const requested = params.indicators?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
    const plan = auth?.user.plan ?? 'FREE';
    const indicators: IndicatorId[] = filterIndicators(plan, requested);

    const provider = marketData();
    const series = await provider.getCandles({
      symbol: meta.symbol,
      timeframe: params.timeframe,
      limit: params.limit,
    });

    return ok({
      symbol: meta.symbol,
      name: meta.name,
      assetClass: meta.assetClass,
      precision: meta.precision,
      timeframe: params.timeframe,
      candles: series.candles,
      provenance: series.provenance,
      indicators: indicators.length ? computeIndicators(series.candles, indicators) : null,
      indicatorSnapshot: indicators.length ? snapshotIndicators(series.candles, indicators) : {},
      /** Indicadores solicitados que el plan actual no incluye. */
      unavailableIndicators: requested.filter((i) => !indicators.includes(i as IndicatorId)),
    });
  } catch (error) {
    return handleError(error);
  }
}
