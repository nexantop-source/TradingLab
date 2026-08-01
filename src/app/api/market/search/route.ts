import { NextRequest } from 'next/server';
import { handleError, ok } from '@/lib/api';
import { getAuth } from '@/lib/auth';
import { marketData, getSymbol } from '@tl/market-data';
import { assetAllowed } from '@/lib/entitlements';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuth();
    const plan = auth?.user.plan ?? 'FREE';
    const query = req.nextUrl.searchParams.get('q') ?? '';

    const provider = marketData();
    const results = await provider.search(query, 30);

    return ok({
      results: results.map((r) => {
        const meta = getSymbol(r.symbol);
        return {
          ...r,
          // El instrumento se muestra siempre, indicando si el plan lo incluye:
          // ocultarlo daría la impresión de que el catálogo es más pequeño.
          available: assetAllowed(plan, (meta?.minPlan ?? 'FREE') as 'FREE' | 'STANDARD' | 'PREMIUM'),
          marketStatus: provider.getMarketStatus(r.symbol),
        };
      }),
    });
  } catch (error) {
    return handleError(error);
  }
}
