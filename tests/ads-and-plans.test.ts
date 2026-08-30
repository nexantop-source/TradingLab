import { describe, it, expect } from 'vitest';
import { selectAd, reviewCreative, isForbiddenSurface, AD_SLOTS, type CandidateCreative } from '@tl/ads';
import { entitlements, planAtLeast, yearlyDiscountPercent, PLAN_ENTITLEMENTS } from '@tl/types/plans';
import { computeStats, type SimulationSample } from '@tl/simulation-engine';
import { INITIAL_DEMO_BALANCE_CENTS, PLANS } from '@tl/types';

const NOW = 1_700_000_000_000;

function candidate(overrides: Partial<CandidateCreative> = {}): CandidateCreative {
  return {
    id: 'cr-1',
    campaignId: 'camp-1',
    advertiserName: 'DataLab Academy',
    headline: 'Curso de estadística aplicada',
    body: 'Ocho semanas sobre inferencia y tamaño de muestra.',
    ctaLabel: 'Ver el temario',
    destinationUrl: 'https://datalab.example/curso',
    imageUrl: null,
    slotCode: 'dashboard-side',
    priority: 5,
    pricingModel: 'FLAT_MONTHLY',
    countries: null,
    locales: null,
    devices: null,
    topics: null,
    marketInterests: null,
    hourRange: null,
    frequencyCapPerDay: 3,
    startsAt: new Date(NOW - 86400000),
    endsAt: new Date(NOW + 86400000),
    status: 'ACTIVE',
    remainingBudgetCents: 100000,
    ...overrides,
  };
}

const targeting = {
  countryCode: 'ES',
  locale: 'es',
  device: 'desktop' as const,
  page: 'dashboard',
  educationalTopic: null,
  plan: 'FREE' as const,
  marketInterest: ['FOREX'],
  hourLocal: 12,
};

describe('selección de anuncios', () => {
  it('nunca sirve publicidad a usuarios Premium', () => {
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting: { ...targeting, plan: 'PREMIUM' },
      candidates: [candidate()],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 0,
    });
    expect(result.ad).toBeNull();
    expect(result.reason).toBe('PLAN_PREMIUM_NO_ADS');
  });

  it('sirve un anuncio elegible al plan Free', () => {
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate()],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 0,
    });
    expect(result.ad).not.toBeNull();
    expect(result.ad?.labeled).toBe(true);
    expect(result.ad?.disclosure.length).toBeGreaterThan(10);
  });

  it('respeta el límite de frecuencia diaria', () => {
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate({ frequencyCapPerDay: 2 })],
      impressionsToday: { 'cr-1': 2 },
      now: NOW,
      rotationSeed: 0,
    });
    expect(result.reason).toBe('ALL_CAPPED');
  });

  it('no sirve campañas sin presupuesto restante', () => {
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate({ remainingBudgetCents: 0 })],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 0,
    });
    expect(result.ad).toBeNull();
  });

  it('no sirve campañas fuera de fecha', () => {
    const future = selectAd({
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate({ startsAt: new Date(NOW + 86400000) })],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 0,
    });
    expect(future.ad).toBeNull();
  });

  it('respeta la segmentación por país', () => {
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate({ countries: ['MX'] })],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 0,
    });
    expect(result.ad).toBeNull();
  });

  it('la selección es determinística con la misma semilla', () => {
    const input = {
      slotCode: 'dashboard-side',
      targeting,
      candidates: [candidate({ id: 'a' }), candidate({ id: 'b' })],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 7,
    };
    expect(selectAd(input).ad?.creativeId).toBe(selectAd(input).ad?.creativeId);
  });

  it('reduce la densidad para el plan Standard', () => {
    // Con una semilla que no es múltiplo de 3, Standard no recibe anuncio.
    const result = selectAd({
      slotCode: 'dashboard-side',
      targeting: { ...targeting, plan: 'STANDARD' },
      candidates: [candidate()],
      impressionsToday: {},
      now: NOW,
      rotationSeed: 1,
    });
    expect(result.ad).toBeNull();
  });
});

describe('superficies prohibidas', () => {
  it('identifica las superficies donde no puede haber publicidad', () => {
    for (const surface of [
      'terminal-chart',
      'terminal-order-form',
      'simulation-confirmation',
      'risk-alert',
      'stop-loss-editor',
      'quiz',
      'ai-analysis',
      'checkout',
    ]) {
      expect(isForbiddenSurface(surface)).toBe(true);
    }
  });

  it('ninguna unidad del inventario declara una superficie prohibida', () => {
    for (const slot of AD_SLOTS) {
      expect(isForbiddenSurface(slot.surface)).toBe(false);
    }
  });
});

describe('revisión de creatividades', () => {
  const base = {
    headline: 'Curso de estadística aplicada',
    body: 'Ocho semanas sobre inferencia y tamaño de muestra.',
    ctaLabel: 'Ver el temario',
    destinationUrl: 'https://datalab.example/curso',
    advertiserCategory: 'EDUCATION',
  };

  it('aprueba una creatividad correcta', () => {
    expect(reviewCreative(base).approved).toBe(true);
  });

  it('rechaza promesas de rentabilidad', () => {
    expect(reviewCreative({ ...base, headline: 'Rentabilidad asegurada del 30 %' }).approved).toBe(false);
  });

  it('rechaza la venta de señales de trading', () => {
    expect(reviewCreative({ ...base, body: 'Recibe señales de trading cada mañana.' }).approved).toBe(false);
  });

  it('rechaza estructuras piramidales', () => {
    expect(reviewCreative({ ...base, body: 'Gana con referidos ilimitados en nuestro plan.' }).approved).toBe(false);
  });

  it('rechaza creatividades que imitan el producto', () => {
    expect(reviewCreative({ ...base, ctaLabel: 'Crear mi cuenta DEMO' }).approved).toBe(false);
  });

  it('rechaza destinos sin HTTPS', () => {
    expect(reviewCreative({ ...base, destinationUrl: 'http://inseguro.example' }).approved).toBe(false);
  });

  it('exige revisión manual para anunciantes financieros', () => {
    const result = reviewCreative({ ...base, advertiserCategory: 'FINANCIAL_SERVICES' });
    expect(result.approved).toBe(false);
    expect(result.issues.some((i) => i.rule === 'revision-manual-obligatoria')).toBe(true);
  });
});

describe('matriz de planes', () => {
  it('todos los planes entregan el mismo saldo inicial', () => {
    expect(INITIAL_DEMO_BALANCE_CENTS).toBe(1_000_000);
  });

  it('Premium nunca muestra publicidad', () => {
    expect(entitlements('PREMIUM').adDensity).toBe('none');
  });

  it('ningún plan permite interstitials', () => {
    for (const id of PLANS) {
      expect(PLAN_ENTITLEMENTS[id].interstitials).toBe(false);
    }
  });

  it('los planes superiores incluyen al menos lo mismo que los inferiores', () => {
    const free = entitlements('FREE');
    const standard = entitlements('STANDARD');
    const premium = entitlements('PREMIUM');

    expect(standard.indicators.length).toBeGreaterThanOrEqual(free.indicators.length);
    expect(premium.indicators.length).toBeGreaterThanOrEqual(standard.indicators.length);
    expect(standard.historyDays).toBeGreaterThan(free.historyDays);
    expect(premium.historyDays).toBeGreaterThan(standard.historyDays);
    expect(premium.portfolios).toBeGreaterThanOrEqual(standard.portfolios);
  });

  it('no vende capacidades que todavía no existen de punta a punta', () => {
    for (const id of PLANS) {
      const features = PLAN_ENTITLEMENTS[id].features;
      expect(features.backtesting).toBe('none');
      expect(features.certificates).toBe('none');
      expect(features.exportCsv).toBe(false);
      expect(features.exportPdf).toBe(false);
      expect(features.multiTimeframeAI).toBe(false);
      expect(features.strategyComparison).toBe(false);
      expect(features.privateTournaments).toBe(false);
      expect(features.weeklyReports).toBe(false);
    }
  });

  it('la comparación de planes es transitiva', () => {
    expect(planAtLeast('PREMIUM', 'FREE')).toBe(true);
    expect(planAtLeast('STANDARD', 'PREMIUM')).toBe(false);
    expect(planAtLeast('FREE', 'FREE')).toBe(true);
  });

  it('el descuento anual es coherente con los precios publicados', () => {
    expect(yearlyDiscountPercent('STANDARD')).toBeGreaterThan(0);
    expect(yearlyDiscountPercent('FREE')).toBe(0);
  });
});

describe('estadísticas educativas', () => {
  function sample(overrides: Partial<SimulationSample> = {}): SimulationSample {
    return {
      id: Math.random().toString(36),
      symbol: 'EURUSD',
      assetClass: 'FOREX',
      mode: 'POSITION',
      direction: 'BULLISH',
      outcome: 'CORRECT',
      pnlCents: 500,
      stakeCents: 10_000,
      leverage: 1,
      hasStopLoss: true,
      hasTakeProfit: true,
      riskReward: 2,
      rationaleLength: 200,
      openedAt: new Date().toISOString(),
      closedAt: new Date().toISOString(),
      hasJournalEntry: true,
      minutesSincePrevious: 60,
      strategyTag: 'ruptura',
      ...overrides,
    };
  }

  it('una muestra vacía no rompe el cálculo', () => {
    const stats = computeStats([], INITIAL_DEMO_BALANCE_CENTS);
    expect(stats.totalSimulations).toBe(0);
    expect(stats.disciplineScore).toBe(0);
  });

  it('un proceso impecable obtiene una puntuación de disciplina alta', () => {
    const stats = computeStats(Array.from({ length: 30 }, () => sample()), INITIAL_DEMO_BALANCE_CENTS);
    expect(stats.disciplineScore).toBeGreaterThan(80);
  });

  it('ganar mucho sin stop loss ni diario penaliza la disciplina', () => {
    const stats = computeStats(
      Array.from({ length: 30 }, () =>
        sample({
          hasStopLoss: false,
          hasTakeProfit: false,
          riskReward: null,
          hasJournalEntry: false,
          rationaleLength: 16,
          pnlCents: 50_000,
          stakeCents: 200_000,
          minutesSincePrevious: 1,
        }),
      ),
      INITIAL_DEMO_BALANCE_CENTS,
    );
    expect(stats.netPnlCents).toBeGreaterThan(0);
    expect(stats.disciplineScore).toBeLessThan(40);
  });

  it('marca como insuficiente una muestra pequeña', () => {
    const stats = computeStats(Array.from({ length: 5 }, () => sample()), INITIAL_DEMO_BALANCE_CENTS);
    expect(stats.sampleReliability).toBe('INSUFICIENTE');
  });

  it('detecta operaciones impulsivas encadenadas', () => {
    const stats = computeStats(
      Array.from({ length: 10 }, () => sample({ minutesSincePrevious: 1 })),
      INITIAL_DEMO_BALANCE_CENTS,
    );
    expect(stats.impulsiveCount).toBe(10);
    expect(stats.repeatedMistakes.some((m) => m.includes('3 minutos'))).toBe(true);
  });

  it('calcula la caída máxima del acumulado', () => {
    const rows = [
      sample({ pnlCents: 1000, closedAt: '2026-01-01T10:00:00.000Z' }),
      sample({ pnlCents: -3000, closedAt: '2026-01-02T10:00:00.000Z', outcome: 'INCORRECT' }),
      sample({ pnlCents: 500, closedAt: '2026-01-03T10:00:00.000Z' }),
    ];
    const stats = computeStats(rows, INITIAL_DEMO_BALANCE_CENTS);
    expect(stats.maxDrawdownCents).toBe(3000);
  });
});
