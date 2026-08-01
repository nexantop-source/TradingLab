/**
 * Semilla de datos de demostración.
 *
 * Crea un entorno completo y navegable: catálogo de instrumentos, academia,
 * glosario, gamificación, documentos legales, inventario publicitario con
 * campañas de ejemplo, y tres usuarios con distinto plan e historial.
 *
 * Es idempotente: puede ejecutarse varias veces sin duplicar nada.
 *
 *   npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SYMBOLS, DEFAULT_WATCHLIST } from '../src/packages/market-data/symbols';
import { SyntheticMarketDataProvider } from '../src/packages/market-data/synthetic-provider';
import { snapshotIndicators } from '../src/packages/market-data/indicators';
import { openSimulation, closeSimulation, settleHypothesis, ENGINE_VERSION } from '../src/packages/simulation-engine/engine';
import { AD_SLOTS, SPONSOR_PACKAGES } from '../src/packages/ads/index';
import { TRACKS } from '../src/content/academy';
import { GLOSSARY } from '../src/content/glossary';
import { BADGES, CHALLENGES } from '../src/content/gamification';
import { LEGAL_DOCS } from '../src/content/legal';
import { EDUCATIONAL_NEWS } from '../src/packages/market-data/news';
import { getEconomicEvents } from '../src/packages/market-data/calendar';
import { PLAN_ENTITLEMENTS } from '../src/packages/types/plans';

const db = new PrismaClient();
const provider = new SyntheticMarketDataProvider();

const INITIAL_BALANCE = 1_000_000;

/** Generador determinístico: la semilla produce siempre los mismos datos. */
let seedCounter = 0;
function nextRandom(): number {
  seedCounter = (seedCounter * 1103515245 + 12345) % 2147483648;
  return seedCounter / 2147483648;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(nextRandom() * arr.length) % arr.length];
}

/** Acota la latencia al rango admitido por la columna entera. */
function safeLatency(ms: number | null | undefined): number {
  if (ms == null || !Number.isFinite(ms)) return 0;
  return Math.max(0, Math.min(Math.round(ms), 3_600_000));
}

async function main() {
  console.log('▸ Sembrando TradingLab…\n');

  await seedPlans();
  await seedAssets();
  await seedProviders();
  await seedAcademy();
  await seedGlossary();
  await seedGamification();
  await seedLegal();
  await seedNews();
  await seedCalendar();
  await seedAds();
  await seedUsers();

  console.log('\n✔ Semilla completada.\n');
  console.log('  Cuentas de demostración (contraseña: Demo1234!):');
  console.log('    estudiante@tradinglab.example  → plan Free, historial inicial');
  console.log('    intermedio@tradinglab.example  → plan Standard, historial amplio');
  console.log('    admin@tradinglab.example       → SUPER_ADMIN, plan Premium\n');
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedPlans() {
  for (const [id, p] of Object.entries(PLAN_ENTITLEMENTS)) {
    await db.plan.upsert({
      where: { id },
      create: {
        id,
        name: p.name,
        priceMonthlyCents: Math.round(p.priceMonthlyUsd * 100),
        priceYearlyCents: Math.round(p.priceYearlyUsd * 100),
        entitlements: JSON.stringify(p),
      },
      update: {
        name: p.name,
        priceMonthlyCents: Math.round(p.priceMonthlyUsd * 100),
        priceYearlyCents: Math.round(p.priceYearlyUsd * 100),
        entitlements: JSON.stringify(p),
      },
    });
  }
  console.log(`  ✓ Planes: ${Object.keys(PLAN_ENTITLEMENTS).length}`);
}

async function seedAssets() {
  for (const s of SYMBOLS) {
    await db.asset.upsert({
      where: { symbol: s.symbol },
      create: {
        symbol: s.symbol,
        name: s.name,
        assetClass: s.assetClass,
        quoteCurrency: s.quoteCurrency,
        precision: s.precision,
        tickSize: s.tickSize,
        spreadBps: s.spreadBps,
        educationalRisk: s.educationalRisk,
        description: s.description,
        minPlan: s.minPlan,
        sessionLabel: s.session.label,
      },
      update: { name: s.name, description: s.description, minPlan: s.minPlan },
    });
  }
  console.log(`  ✓ Instrumentos: ${SYMBOLS.length}`);
}

async function seedProviders() {
  await db.dataProviderRecord.upsert({
    where: { id: 'synthetic-v1' },
    create: {
      id: 'synthetic-v1',
      label: 'Serie educativa determinística',
      synthetic: true,
      active: true,
      declaredDelaySec: 0,
      lastStatus: 'OK',
      lastHealthCheck: new Date(),
      lastLatencyMs: 1,
    },
    update: { active: true, lastStatus: 'OK', lastHealthCheck: new Date() },
  });

  // Proveedores comerciales registrados pero inactivos: quedan listos para
  // activarse en cuanto se configure la credencial correspondiente.
  for (const p of [
    { id: 'twelvedata', label: 'Twelve Data', delay: 0 },
    { id: 'finnhub', label: 'Finnhub', delay: 900 },
  ]) {
    await db.dataProviderRecord.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        label: p.label,
        synthetic: false,
        active: false,
        declaredDelaySec: p.delay,
        lastStatus: 'NOT_CONFIGURED',
      },
      update: {},
    });
  }
  console.log('  ✓ Proveedores de datos: 3 (1 activo)');
}

async function seedAcademy() {
  let lessonCount = 0;
  for (const [ti, track] of TRACKS.entries()) {
    const t = await db.track.upsert({
      where: { slug: track.slug },
      create: {
        slug: track.slug,
        title: track.title,
        summary: track.summary,
        level: track.level,
        topic: track.topic,
        icon: track.icon,
        minPlan: track.minPlan,
        position: ti,
      },
      update: { title: track.title, summary: track.summary, position: ti },
    });

    for (const [ci, course] of track.courses.entries()) {
      const c = await db.course.upsert({
        where: { slug: course.slug },
        create: {
          trackId: t.id,
          slug: course.slug,
          title: course.title,
          summary: course.summary,
          minPlan: course.minPlan,
          position: ci,
        },
        update: { title: course.title, summary: course.summary },
      });

      for (const [mi, mod] of course.modules.entries()) {
        const m = await db.module.upsert({
          where: { slug: mod.slug },
          create: { courseId: c.id, slug: mod.slug, title: mod.title, position: mi },
          update: { title: mod.title },
        });

        for (const [li, lesson] of mod.lessons.entries()) {
          const l = await db.lesson.upsert({
            where: { slug: lesson.slug },
            create: {
              moduleId: m.id,
              slug: lesson.slug,
              title: lesson.title,
              summary: lesson.summary,
              blocks: JSON.stringify(lesson.blocks),
              estimatedMinutes: lesson.estimatedMinutes,
              minPlan: lesson.minPlan,
              requiresSimulation: lesson.requiresSimulation ?? false,
              topic: lesson.topic,
              position: li,
            },
            update: {
              title: lesson.title,
              summary: lesson.summary,
              blocks: JSON.stringify(lesson.blocks),
            },
          });
          lessonCount++;

          if (lesson.quiz) {
            await db.quiz.upsert({
              where: { lessonId: l.id },
              create: {
                lessonId: l.id,
                questions: JSON.stringify(lesson.quiz.questions),
                passingScore: lesson.quiz.passingScore ?? 70,
              },
              update: { questions: JSON.stringify(lesson.quiz.questions) },
            });
          }
        }
      }
    }
  }
  console.log(`  ✓ Academia: ${TRACKS.length} rutas, ${lessonCount} lecciones`);
}

async function seedGlossary() {
  for (const g of GLOSSARY) {
    await db.glossaryTerm.upsert({
      where: { slug: g.slug },
      create: { slug: g.slug, term: g.term, definition: g.definition, category: g.category, related: JSON.stringify(g.related) },
      update: { definition: g.definition },
    });
  }
  console.log(`  ✓ Glosario: ${GLOSSARY.length} términos`);
}

async function seedGamification() {
  for (const b of BADGES) {
    await db.badge.upsert({
      where: { slug: b.slug },
      create: { slug: b.slug, name: b.name, description: b.description, criterion: b.criterion, icon: b.icon, category: b.category },
      update: { description: b.description },
    });
  }

  const now = Date.now();
  for (const c of CHALLENGES) {
    await db.challenge.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        title: c.title,
        description: c.description,
        metric: c.metric,
        target: c.target,
        xpReward: c.xpReward,
        startsAt: new Date(now - 86400000),
        endsAt: new Date(now + c.durationDays * 86400000),
        visibility: c.visibility,
        minPlan: c.minPlan,
      },
      update: { description: c.description, endsAt: new Date(now + c.durationDays * 86400000) },
    });
  }
  console.log(`  ✓ Gamificación: ${BADGES.length} insignias, ${CHALLENGES.length} retos`);
}

async function seedLegal() {
  for (const d of LEGAL_DOCS) {
    await db.legalDocument.upsert({
      where: { slug_version: { slug: d.slug, version: d.version } },
      create: {
        slug: d.slug,
        version: d.version,
        title: d.title,
        body: JSON.stringify(d.sections),
        effectiveAt: new Date(d.effectiveAt),
      },
      update: { body: JSON.stringify(d.sections) },
    });
  }
  console.log(`  ✓ Documentos legales: ${LEGAL_DOCS.length}`);
}

async function seedNews() {
  for (const n of EDUCATIONAL_NEWS) {
    await db.newsArticleRecord.upsert({
      where: { slug: n.slug },
      create: {
        slug: n.slug,
        kind: n.kind,
        title: n.title,
        summary: n.summary,
        body: n.body,
        source: n.source,
        sourceUrl: n.sourceUrl,
        tags: JSON.stringify(n.tags),
        relatedSymbols: JSON.stringify(n.relatedSymbols),
        readingMinutes: n.readingMinutes,
        publishedAt: new Date(n.publishedAt),
      },
      update: { title: n.title, body: n.body },
    });
  }
  console.log(`  ✓ Artículos educativos: ${EDUCATIONAL_NEWS.length}`);
}

async function seedCalendar() {
  const from = Date.now() - 7 * 86400000;
  const to = Date.now() + 30 * 86400000;
  const events = getEconomicEvents(from, to);
  for (const e of events) {
    await db.economicEventRecord.upsert({
      where: { id: e.id },
      create: {
        id: e.id,
        time: new Date(e.time),
        country: e.country,
        countryCode: e.countryCode,
        currency: e.currency,
        title: e.title,
        impact: e.impact,
        educationalNote: e.educationalNote,
        relatedSymbols: JSON.stringify(e.relatedSymbols),
      },
      update: {},
    });
  }
  console.log(`  ✓ Calendario económico: ${events.length} eventos`);
}

async function seedAds() {
  for (const slot of AD_SLOTS) {
    await db.adUnit.upsert({
      where: { id: slot.code },
      create: {
        id: slot.code,
        label: slot.label,
        format: slot.format,
        reservedHeight: slot.reservedHeight,
        surface: slot.surface,
        description: slot.description,
      },
      update: { label: slot.label, description: slot.description },
    });
    await db.placement.upsert({
      where: { id: `pl-${slot.code}` },
      create: { id: `pl-${slot.code}`, adUnitId: slot.code, page: slot.surface },
      update: {},
    });
  }

  // Anunciantes de ejemplo, ninguno del sector financiero: así la semilla no
  // sugiere que se pueda anunciar un producto de inversión sin revisión.
  const advertisers = [
    { id: 'adv-datalab', name: 'DataLab Academy', email: 'partners@datalab.example', category: 'EDUCATION', status: 'APPROVED' },
    { id: 'adv-nubemetrics', name: 'NubeMetrics', email: 'ads@nubemetrics.example', category: 'SOFTWARE', status: 'APPROVED' },
    { id: 'adv-fintechpress', name: 'FintechPress', email: 'media@fintechpress.example', category: 'MEDIA', status: 'APPROVED' },
  ];

  for (const a of advertisers) {
    await db.advertiser.upsert({
      where: { id: a.id },
      create: { id: a.id, name: a.name, contactEmail: a.email, category: a.category, status: a.status },
      update: { status: a.status },
    });
  }

  const campaigns = [
    {
      id: 'camp-datalab-q1',
      advertiserId: 'adv-datalab',
      name: 'DataLab · Curso de estadística aplicada',
      slot: 'dashboard-side',
      pricingModel: 'FLAT_MONTHLY',
      unitPriceCents: 75_000,
      budgetCents: 150_000,
      priority: 5,
      packageCode: 'starter-sponsor',
      creative: {
        headline: 'Estadística aplicada para analizar datos con criterio',
        body: 'Curso online de ocho semanas sobre inferencia, tamaño de muestra e interpretación de resultados.',
        cta: 'Ver el temario',
        url: 'https://datalab.example/curso',
      },
    },
    {
      id: 'camp-nubemetrics',
      advertiserId: 'adv-nubemetrics',
      name: 'NubeMetrics · Herramienta de visualización',
      slot: 'dashboard-banner',
      pricingModel: 'CPM',
      unitPriceCents: 450,
      budgetCents: 300_000,
      priority: 3,
      packageCode: 'market-sponsor',
      creative: {
        headline: 'Visualiza tus series temporales sin escribir código',
        body: 'Importa un CSV y obtén gráficos publicables en minutos. Plan gratuito para estudiantes.',
        cta: 'Probar gratis',
        url: 'https://nubemetrics.example',
      },
    },
    {
      id: 'camp-fintechpress',
      advertiserId: 'adv-fintechpress',
      name: 'FintechPress · Boletín semanal',
      slot: 'news-native',
      pricingModel: 'CPC',
      unitPriceCents: 60,
      budgetCents: 120_000,
      priority: 2,
      packageCode: null,
      creative: {
        headline: 'Un resumen semanal de economía, explicado sin jerga',
        body: 'Boletín gratuito con el contexto de las principales publicaciones macroeconómicas de la semana.',
        cta: 'Suscribirme al boletín',
        url: 'https://fintechpress.example/boletin',
      },
    },
  ];

  for (const c of campaigns) {
    await db.adCampaign.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        advertiserId: c.advertiserId,
        name: c.name,
        status: 'ACTIVE',
        pricingModel: c.pricingModel,
        unitPriceCents: c.unitPriceCents,
        budgetCents: c.budgetCents,
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 60 * 86400000),
        frequencyCapPerDay: 4,
        priority: c.priority,
        packageCode: c.packageCode,
        targeting: JSON.stringify({ locales: ['es'], devices: null, countries: null }),
      },
      update: { status: 'ACTIVE' },
    });

    await db.creative.upsert({
      where: { id: `cr-${c.id}` },
      create: {
        id: `cr-${c.id}`,
        campaignId: c.id,
        placementId: `pl-${c.slot}`,
        headline: c.creative.headline,
        body: c.creative.body,
        ctaLabel: c.creative.cta,
        destinationUrl: c.creative.url,
        reviewStatus: 'APPROVED',
        reviewReport: JSON.stringify({ approved: true, issues: [], reviewedBy: 'seed' }),
        reviewedAt: new Date(),
      },
      update: { reviewStatus: 'APPROVED' },
    });
  }

  console.log(
    `  ✓ Publicidad: ${AD_SLOTS.length} espacios, ${advertisers.length} anunciantes, ${campaigns.length} campañas, ${SPONSOR_PACKAGES.length} paquetes`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

async function seedUsers() {
  const passwordHash = await bcrypt.hash('Demo1234!', 12);

  const student = await upsertUser({
    email: 'estudiante@tradinglab.example',
    name: 'Ana Estudiante',
    passwordHash,
    role: 'STUDENT',
    plan: 'FREE',
    experienceLevel: 'PRINCIPIANTE',
    marketInterests: ['FOREX', 'CRYPTO'],
    goal: 'entender-mercados',
    riskScore: 42,
  });

  const intermediate = await upsertUser({
    email: 'intermedio@tradinglab.example',
    name: 'Bruno Intermedio',
    passwordHash,
    role: 'STUDENT',
    plan: 'STANDARD',
    experienceLevel: 'INTERMEDIO',
    marketInterests: ['FOREX', 'STOCK', 'INDEX'],
    goal: 'gestion-riesgo',
    riskScore: 71,
  });

  const admin = await upsertUser({
    email: 'admin@tradinglab.example',
    name: 'Carla Administración',
    passwordHash,
    role: 'SUPER_ADMIN',
    plan: 'PREMIUM',
    experienceLevel: 'AVANZADO',
    marketInterests: ['FOREX', 'CRYPTO', 'STOCK', 'INDEX', 'COMMODITY'],
    goal: 'estrategia',
    riskScore: 92,
  });

  await seedHistory(student.id, 9);
  await seedHistory(intermediate.id, 34);
  await seedHistory(admin.id, 18);

  console.log('  ✓ Usuarios de demostración: 3, con historial de simulaciones y diario');
}

async function upsertUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  plan: string;
  experienceLevel: string;
  marketInterests: string[];
  goal: string;
  riskScore: number;
}) {
  const user = await db.user.upsert({
    where: { email: input.email },
    create: {
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      role: input.role,
      emailVerifiedAt: new Date(),
      onboardingCompleted: true,
      locale: 'es',
      timezone: 'Europe/Madrid',
      countryCode: 'ES',
      streakDays: 4,
      streakUpdatedAt: new Date(),
      xp: 320,
      level: 3,
      lastSeenAt: new Date(),
    },
    update: { passwordHash: input.passwordHash, role: input.role },
  });

  await db.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      experienceLevel: input.experienceLevel,
      marketInterests: JSON.stringify(input.marketInterests),
      educationalGoal: input.goal,
      weeklyAvailability: 6,
      riskKnowledgeScore: input.riskScore,
    },
    update: { experienceLevel: input.experienceLevel },
  });

  if (input.plan !== 'FREE') {
    await db.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        planId: input.plan,
        status: 'ACTIVE',
        interval: 'MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
      update: { planId: input.plan, status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 30 * 86400000) },
    });
  }

  // Cuenta DEMO con su asiento de apertura.
  let account = await db.demoAccount.findFirst({ where: { userId: user.id } });
  if (!account) {
    account = await db.demoAccount.create({
      data: { userId: user.id, balanceCents: INITIAL_BALANCE },
    });
    await db.demoBalanceLedger.create({
      data: {
        demoAccountId: account.id,
        amountCents: INITIAL_BALANCE,
        balanceAfterCents: INITIAL_BALANCE,
        reason: 'ACCOUNT_OPENING',
        memo: 'Saldo virtual inicial de USD 10.000. No es dinero real y no puede retirarse.',
      },
    });
  }

  // Lista de seguimiento inicial.
  for (const [i, symbol] of DEFAULT_WATCHLIST.entries()) {
    await db.watchlistItem.upsert({
      where: { userId_symbol: { userId: user.id, symbol } },
      create: { userId: user.id, symbol, position: i, favorite: i < 2 },
      update: {},
    });
  }

  // Portafolio DEMO.
  const existingPortfolio = await db.portfolio.findFirst({ where: { userId: user.id } });
  if (!existingPortfolio) {
    await db.portfolio.create({
      data: { userId: user.id, demoAccountId: account.id, name: 'Portafolio principal', benchmark: 'SPX500' },
    });
  }

  return user;
}

/**
 * Historial de simulaciones ya cerradas, calculado con el motor real.
 * No se inventan resultados: se abren y se cierran con precios determinísticos
 * del proveedor sintético, igual que haría la aplicación.
 */
async function seedHistory(userId: string, count: number) {
  const existing = await db.simulation.count({ where: { userId } });
  if (existing >= count) return;

  const account = await db.demoAccount.findFirst({ where: { userId } });
  if (!account) return;

  const tradable = SYMBOLS.filter((s) => s.minPlan === 'FREE');
  const rationales = [
    'El precio defiende la zona de soporte identificada ayer y la media de 20 periodos acompaña. Invalido la idea si cierra por debajo del mínimo de la sesión.',
    'Estructura de máximos decrecientes en la temporalidad de una hora. Busco continuación bajista hasta la referencia inferior del rango.',
    'El RSI se recupera desde zona baja y coincide con un nivel donde ya hubo interés comprador. Riesgo limitado al 1 % del saldo.',
    'Prueba de resistencia por cuarta vez. Si la supera con cuerpo amplio, espero continuación; si la rechaza otra vez, la idea queda invalidada.',
    'Volatilidad comprimida según las bandas de Bollinger. No tengo dirección clara, así que reduzco tamaño y planteo un plazo corto.',
    'Publicación macroeconómica en dos horas. Abro con tamaño reducido y asumo que el spread se ampliará.',
  ];
  const tags = ['ruptura', 'reversion-a-la-media', 'continuacion-de-tendencia', 'rango', 'evento-macro'];
  const emotions = ['CALMADO', 'ENFOCADO', 'CONFIADO', 'ANSIOSO', 'IMPACIENTE', 'DUDOSO'];

  let balance = account.balanceCents;
  const ledger: Array<{ amountCents: number; balanceAfterCents: number; reason: string; reference: string; memo: string; createdAt: Date }> = [];

  for (let i = existing; i < count; i++) {
    const meta = pick(tradable);
    const daysAgo = Math.floor(nextRandom() * 25) + 1;
    const openedAt = new Date(Date.now() - daysAgo * 86400000 - Math.floor(nextRandom() * 8) * 3600000);
    const durationMinutes = pick([15, 30, 60, 240]);
    const closedAt = new Date(openedAt.getTime() + durationMinutes * 60000);

    const isHypothesis = nextRandom() < 0.6;
    const direction = nextRandom() < 0.5 ? 'BULLISH' : 'BEARISH';
    const stakeCents = Math.round((50 + nextRandom() * 250)) * 100;
    const leverage = isHypothesis ? 1 : pick([1, 1, 2, 5, 10]);

    const entryQuote = await provider.getQuote(meta.symbol, openedAt.getTime());
    const exitPoint = await provider.getPriceAt(meta.symbol, closedAt.getTime());

    const opened = openSimulation({
      mode: isHypothesis ? 'HYPOTHESIS' : 'POSITION',
      direction,
      midPrice: entryQuote.price,
      spreadBps: meta.spreadBps,
      stakeCents,
      leverage,
      precision: meta.precision,
    });

    const series = await provider.getCandles({
      symbol: meta.symbol,
      timeframe: '1h',
      limit: 120,
      to: openedAt.getTime(),
    });
    const indicatorValues = snapshotIndicators(series.candles, ['SMA20', 'RSI14', 'ATR14']);
    const atr = indicatorValues['ATR14'];

    let pnlCents: number;
    let outcome: string;
    let audit: string[];
    let exitPrice: number;

    if (isHypothesis) {
      const settled = settleHypothesis({
        direction,
        entryPrice: opened.entryPrice,
        exitPrice: exitPoint.price,
        stakeCents,
        referenceMovePercent: atr != null ? (atr / opened.entryPrice) * 100 : 0.35,
      });
      pnlCents = settled.pnlCents;
      outcome = settled.outcome;
      audit = settled.audit;
      exitPrice = exitPoint.price;
    } else {
      const result = closeSimulation({
        mode: 'POSITION',
        direction,
        entryPrice: opened.entryPrice,
        exitMidPrice: exitPoint.price,
        spreadBps: meta.spreadBps,
        quantity: opened.quantity,
        stakeCents,
        leverage,
        precision: meta.precision,
        closeReason: 'MANUAL',
        openFeeCents: opened.feeCents,
      });
      pnlCents = result.pnlCents;
      outcome = result.outcome;
      audit = result.audit;
      exitPrice = result.exitPrice;
    }

    const hasStop = !isHypothesis && nextRandom() < 0.75;
    const stopDistance = opened.entryPrice * 0.004;
    const stopLoss = hasStop
      ? direction === 'BULLISH'
        ? Number((opened.entryPrice - stopDistance).toFixed(meta.precision))
        : Number((opened.entryPrice + stopDistance).toFixed(meta.precision))
      : null;
    const takeProfit =
      hasStop && nextRandom() < 0.8
        ? direction === 'BULLISH'
          ? Number((opened.entryPrice + stopDistance * 2).toFixed(meta.precision))
          : Number((opened.entryPrice - stopDistance * 2).toFixed(meta.precision))
        : null;

    const rationale = pick(rationales);
    const strategyTag = pick(tags);

    const sim = await db.simulation.create({
      data: {
        userId,
        demoAccountId: account.id,
        mode: isHypothesis ? 'HYPOTHESIS' : 'POSITION',
        symbol: meta.symbol,
        assetClass: meta.assetClass,
        direction,
        status: 'CLOSED',
        outcome,
        orderType: 'MARKET',
        stakeCents,
        leverage,
        quantity: opened.quantity,
        entryPrice: opened.entryPrice,
        exitPrice,
        stopLoss,
        takeProfit,
        feeCents: opened.feeCents,
        pnlCents,
        openedAt,
        expiresAt: isHypothesis ? closedAt : null,
        closedAt,
        closeReason: isHypothesis ? 'EXPIRY' : 'MANUAL',
        rationale,
        confidence: pick(['LOW', 'MEDIUM', 'HIGH']),
        perceivedRisk: Math.floor(nextRandom() * 5) + 1,
        strategyTag,
        engineVersion: ENGINE_VERSION,
        priceSourceProvider: entryQuote.provenance.provider,
        priceSourceTimestamp: new Date(entryQuote.provenance.sourceTimestamp),
        entryLatencyMs: safeLatency(entryQuote.provenance.latencyMs),
        exitSourceProvider: exitPoint.provenance.provider,
        exitSourceTimestamp: new Date(exitPoint.provenance.sourceTimestamp),
        exitLatencyMs: safeLatency(exitPoint.provenance.latencyMs),
        userTimezone: 'Europe/Madrid',
        contextSnapshot: JSON.stringify({
          engineVersion: ENGINE_VERSION,
          timeframe: '1h',
          visibleIndicators: ['SMA20', 'RSI14', 'ATR14'],
          indicatorValues,
          provenance: entryQuote.provenance,
          userTimezone: 'Europe/Madrid',
          chartType: 'candles',
          recentCandles: series.candles.slice(-40),
        }),
        settlementAudit: JSON.stringify(audit),
      },
    });

    // Asientos del libro mayor, coherentes con la operación.
    balance -= stakeCents;
    ledger.push({
      amountCents: -stakeCents,
      balanceAfterCents: balance,
      reason: 'SIMULATION_MARGIN_HOLD',
      reference: sim.id,
      memo: `Margen virtual retenido para la simulación de ${meta.symbol}.`,
      createdAt: openedAt,
    });
    balance -= opened.feeCents;
    ledger.push({
      amountCents: -opened.feeCents,
      balanceAfterCents: balance,
      reason: 'SIMULATION_FEE',
      reference: sim.id,
      memo: 'Spread virtual educativo aplicado en la apertura.',
      createdAt: openedAt,
    });
    const settlement = Math.max(0, stakeCents + pnlCents);
    balance += settlement;
    ledger.push({
      amountCents: settlement,
      balanceAfterCents: balance,
      reason: 'SIMULATION_SETTLEMENT',
      reference: sim.id,
      memo: `Liquidación de la simulación sobre ${meta.symbol}.`,
      createdAt: closedAt,
    });

    // Entrada de diario en aproximadamente dos de cada tres simulaciones.
    if (nextRandom() < 0.65) {
      await db.journalEntry.create({
        data: {
          userId,
          simulationId: sim.id,
          title: `${direction === 'BULLISH' ? 'Hipótesis alcista' : 'Hipótesis bajista'} en ${meta.symbol}`,
          hypothesis: rationale,
          entryReason: rationale,
          emotionBefore: pick(emotions),
          emotionAfter: pick(emotions),
          riskLevel: Math.floor(nextRandom() * 5) + 1,
          indicatorsUsed: JSON.stringify(['SMA20', 'RSI14', 'ATR14']),
          result: outcome,
          mistake:
            outcome === 'INCORRECT'
              ? pick([
                  'Entré antes de que se confirmara la ruptura.',
                  'El stop loss estaba demasiado ajustado para la volatilidad del momento.',
                  'No comprobé el calendario económico antes de abrir.',
                  'Aumenté el tamaño respecto a lo que había planificado.',
                ])
              : null,
          lesson: pick([
            'Esperar el cierre de la vela antes de decidir.',
            'Dimensionar el stop loss con el ATR, no con la comodidad.',
            'Revisar el calendario económico antes de cada apertura.',
            'Escribir la invalidación antes que el objetivo.',
          ]),
          tags: JSON.stringify([strategyTag]),
          createdAt: closedAt,
        },
      });
    }
  }

  // Escribe el libro mayor y actualiza el saldo en una transacción.
  if (ledger.length) {
    await db.$transaction([
      ...ledger.map((l) =>
        db.demoBalanceLedger.create({
          data: {
            demoAccountId: account.id,
            amountCents: l.amountCents,
            balanceAfterCents: l.balanceAfterCents,
            reason: l.reason,
            reference: l.reference,
            memo: l.memo,
            createdAt: l.createdAt,
          },
        }),
      ),
      db.demoAccount.update({ where: { id: account.id }, data: { balanceCents: balance } }),
    ]);
  }

  // Progreso educativo: las primeras lecciones completadas.
  const lessons = await db.lesson.findMany({ orderBy: { position: 'asc' }, take: 4 });
  for (const l of lessons) {
    await db.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId: l.id } },
      create: { userId, lessonId: l.id, status: 'COMPLETED', completedAt: new Date() },
      update: {},
    });
  }
}

main()
  .catch((e) => {
    console.error('\n✖ Error al sembrar:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
