import type { AdSlotDescriptor, PlanId, ServedAd } from '@tl/types';
import { DISCLAIMERS } from '@tl/types/compliance';

/**
 * Servidor publicitario interno.
 *
 * Reglas duras codificadas aquí, no en la interfaz:
 *  - Premium nunca recibe publicidad (criterio de aceptación #12).
 *  - Existe una lista de superficies prohibidas donde ningún anuncio puede
 *    servirse, aunque un administrador cree el emplazamiento por error.
 *  - Todo anuncio se entrega etiquetado; el componente de render no permite
 *    ocultar la etiqueta.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inventario
// ─────────────────────────────────────────────────────────────────────────────

export const AD_SLOTS: AdSlotDescriptor[] = [
  { code: 'dashboard-banner', label: 'Banner del panel', format: 'BANNER', reservedHeight: 96, surface: 'dashboard', description: 'Banner horizontal bajo el resumen del panel principal.' },
  { code: 'dashboard-side', label: 'Tarjeta lateral del panel', format: 'SIDE_CARD', reservedHeight: 260, surface: 'dashboard', description: 'Tarjeta vertical en la columna derecha del panel.' },
  { code: 'academy-footer', label: 'Banner inferior de academia', format: 'BANNER', reservedHeight: 96, surface: 'academy', description: 'Banner al final del listado de rutas y cursos.' },
  { code: 'lesson-sponsor', label: 'Patrocinador de lección', format: 'SPONSOR_STRIP', reservedHeight: 64, surface: 'lesson', description: 'Franja de patrocinio al pie de una lección. Nunca dentro del cuestionario.' },
  { code: 'calendar-sponsor', label: 'Patrocinador del calendario económico', format: 'SPONSOR_STRIP', reservedHeight: 64, surface: 'calendar', description: 'Franja de patrocinio en la cabecera del calendario.' },
  { code: 'newsletter-sponsor', label: 'Patrocinador de newsletter', format: 'NEWSLETTER', reservedHeight: 0, surface: 'email', description: 'Bloque patrocinado dentro del boletín educativo.' },
  { code: 'news-native', label: 'Tarjeta nativa en noticias', format: 'NATIVE_CARD', reservedHeight: 200, surface: 'news', description: 'Tarjeta con formato de artículo, siempre etiquetada como patrocinada.' },
  { code: 'public-banner', label: 'Banner responsive en páginas públicas', format: 'BANNER', reservedHeight: 96, surface: 'public', description: 'Banner en páginas públicas de contenido, fuera del embudo de registro.' },
  { code: 'challenge-sponsor', label: 'Patrocinador de retos educativos', format: 'SPONSOR_STRIP', reservedHeight: 64, surface: 'challenges', description: 'Patrocinio visible en la portada de retos.' },
  { code: 'weekly-report-sponsor', label: 'Patrocinador de informes semanales', format: 'SPONSOR_STRIP', reservedHeight: 64, surface: 'reports', description: 'Patrocinio al pie del informe semanal.' },
];

export const AD_SLOT_BY_CODE = new Map(AD_SLOTS.map((s) => [s.code, s]));

/**
 * Superficies donde queda prohibido servir publicidad. La comprobación es
 * defensiva: `selectAd` devuelve `null` aunque exista una campaña activa.
 */
export const FORBIDDEN_SURFACES = [
  'terminal-chart',
  'terminal-order-form',
  'simulation-confirmation',
  'risk-alert',
  'stop-loss-editor',
  'quiz',
  'ai-analysis',
  'checkout',
] as const;

export type ForbiddenSurface = (typeof FORBIDDEN_SURFACES)[number];

export function isForbiddenSurface(surface: string): boolean {
  return (FORBIDDEN_SURFACES as readonly string[]).includes(surface);
}

// ─────────────────────────────────────────────────────────────────────────────
// Selección
// ─────────────────────────────────────────────────────────────────────────────

export interface AdTargeting {
  countryCode: string | null;
  locale: string;
  device: 'desktop' | 'mobile' | 'tablet';
  page: string;
  educationalTopic: string | null;
  plan: PlanId;
  marketInterest: string[];
  /** Hora local del usuario, 0-23. */
  hourLocal: number;
}

export interface CandidateCreative {
  id: string;
  campaignId: string;
  advertiserName: string;
  headline: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  imageUrl: string | null;
  slotCode: string;
  /** Prioridad manual, mayor gana. Las ventas directas van por encima. */
  priority: number;
  pricingModel: string;
  /** Restricciones de segmentación. `null` significa sin restricción. */
  countries: string[] | null;
  locales: string[] | null;
  devices: string[] | null;
  topics: string[] | null;
  marketInterests: string[] | null;
  hourRange: [number, number] | null;
  /** Impresiones por usuario y día. */
  frequencyCapPerDay: number;
  startsAt: Date | string;
  endsAt: Date | string | null;
  status: string;
  /** Presupuesto restante en centavos. Si llega a 0, deja de servirse. */
  remainingBudgetCents: number | null;
}

export interface SelectionInput {
  slotCode: string;
  targeting: AdTargeting;
  candidates: CandidateCreative[];
  /** Impresiones ya servidas hoy a este usuario, por creatividad. */
  impressionsToday: Record<string, number>;
  /** Instante de la decisión. Se pasa para que la función sea determinística. */
  now: number;
  /** Semilla estable del usuario, para rotar sin `Math.random`. */
  rotationSeed: number;
}

export interface SelectionResult {
  ad: ServedAd | null;
  /** Motivo cuando no se sirve nada. Útil para depurar el fill rate. */
  reason:
    | 'SERVED'
    | 'PLAN_PREMIUM_NO_ADS'
    | 'FORBIDDEN_SURFACE'
    | 'UNKNOWN_SLOT'
    | 'NO_CANDIDATES'
    | 'ALL_CAPPED'
    | 'NO_MATCH';
}

export function selectAd(input: SelectionInput): SelectionResult {
  // 1. Premium: sin publicidad, sin excepciones.
  if (input.targeting.plan === 'PREMIUM') {
    return { ad: null, reason: 'PLAN_PREMIUM_NO_ADS' };
  }

  const slot = AD_SLOT_BY_CODE.get(input.slotCode);
  if (!slot) return { ad: null, reason: 'UNKNOWN_SLOT' };

  // 2. Superficies prohibidas.
  if (isForbiddenSurface(slot.surface) || isForbiddenSurface(input.targeting.page)) {
    return { ad: null, reason: 'FORBIDDEN_SURFACE' };
  }

  if (input.candidates.length === 0) return { ad: null, reason: 'NO_CANDIDATES' };

  const t = input.targeting;
  let anyCapped = false;

  const eligible = input.candidates.filter((c) => {
    if (c.slotCode !== input.slotCode) return false;
    if (c.status !== 'ACTIVE') return false;
    if (new Date(c.startsAt).getTime() > input.now) return false;
    if (c.endsAt && new Date(c.endsAt).getTime() < input.now) return false;
    if (c.remainingBudgetCents != null && c.remainingBudgetCents <= 0) return false;

    if (c.countries && t.countryCode && !c.countries.includes(t.countryCode)) return false;
    if (c.locales && !c.locales.includes(t.locale)) return false;
    if (c.devices && !c.devices.includes(t.device)) return false;
    if (c.topics && t.educationalTopic && !c.topics.includes(t.educationalTopic)) return false;
    if (c.marketInterests && !c.marketInterests.some((m) => t.marketInterest.includes(m))) return false;
    if (c.hourRange) {
      const [from, to] = c.hourRange;
      const h = t.hourLocal;
      const inRange = from <= to ? h >= from && h <= to : h >= from || h <= to;
      if (!inRange) return false;
    }

    const served = input.impressionsToday[c.id] ?? 0;
    if (served >= c.frequencyCapPerDay) {
      anyCapped = true;
      return false;
    }
    return true;
  });

  if (eligible.length === 0) {
    return { ad: null, reason: anyCapped ? 'ALL_CAPPED' : 'NO_MATCH' };
  }

  // 3. Densidad por plan: Standard ve menos inventario que Free.
  //    Se aplica reduciendo la probabilidad de servir mediante la semilla.
  if (t.plan === 'STANDARD' && input.rotationSeed % 3 !== 0) {
    return { ad: null, reason: 'NO_MATCH' };
  }

  // 4. Ordena por prioridad y rota de forma determinística dentro del mismo nivel.
  const maxPriority = Math.max(...eligible.map((c) => c.priority));
  const top = eligible.filter((c) => c.priority === maxPriority);
  const chosen = top[input.rotationSeed % top.length];

  return {
    ad: {
      creativeId: chosen.id,
      campaignId: chosen.campaignId,
      advertiserName: chosen.advertiserName,
      headline: chosen.headline,
      body: chosen.body,
      ctaLabel: chosen.ctaLabel,
      destinationUrl: chosen.destinationUrl,
      imageUrl: chosen.imageUrl,
      format: slot.format,
      labeled: true,
      disclosure: DISCLAIMERS.ad,
    },
    reason: 'SERVED',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revisión de creatividades
// ─────────────────────────────────────────────────────────────────────────────

import { FORBIDDEN_CLAIMS } from '@tl/types/compliance';

export interface CreativeReviewResult {
  approved: boolean;
  issues: Array<{ rule: string; detail: string }>;
}

const IMPERSONATION_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(crear|abrir)\s+(mi\s+)?cuenta\s+demo\b/i, label: 'imita el botón principal del producto' },
  { re: /\ban[aá]lisis\s+(de|con)\s+ia\b/i, label: 'puede confundirse con el asistente educativo del producto' },
  { re: /\btradinglab\b/i, label: 'usa la marca de la plataforma' },
  { re: /\b(hip[oó]tesis\s+(alcista|bajista))\b/i, label: 'imita la terminología de la terminal de simulación' },
];

const INVESTMENT_ADVICE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\b(invierte|invertí|deposita|deposit[aá])\s+(ahora|ya|hoy)\b/i, label: 'llamada directa a invertir' },
  { re: /\b(rentabilidad|retorno)\s+(del?\s+)?\d+\s*%/i, label: 'promesa de rentabilidad concreta' },
  { re: /\bse[nñ]ales\s+de\s+trading\b/i, label: 'venta de señales de trading' },
  { re: /\bpir[aá]mide|multinivel|referidos\s+ilimitados\b/i, label: 'estructura piramidal o multinivel' },
];

/** Revisión automática previa a la revisión manual obligatoria. */
export function reviewCreative(creative: {
  headline: string;
  body: string;
  ctaLabel: string;
  destinationUrl: string;
  advertiserCategory: string;
}): CreativeReviewResult {
  const issues: CreativeReviewResult['issues'] = [];
  const text = `${creative.headline}\n${creative.body}\n${creative.ctaLabel}`;
  const lower = text.toLowerCase();

  for (const claim of FORBIDDEN_CLAIMS) {
    if (lower.includes(claim)) {
      issues.push({ rule: 'promesa-prohibida', detail: `El texto contiene "${claim}".` });
    }
  }
  for (const p of [...IMPERSONATION_PATTERNS, ...INVESTMENT_ADVICE_PATTERNS]) {
    if (p.re.test(text)) issues.push({ rule: p.label, detail: `Coincide con el patrón ${p.re}.` });
  }
  if (!/^https:\/\//i.test(creative.destinationUrl)) {
    issues.push({ rule: 'destino-inseguro', detail: 'La URL de destino debe usar HTTPS.' });
  }
  if (creative.advertiserCategory === 'FINANCIAL_SERVICES') {
    issues.push({
      rule: 'revision-manual-obligatoria',
      detail: 'Los anunciantes financieros requieren revisión manual de cumplimiento antes de activarse.',
    });
  }

  return { approved: issues.length === 0, issues };
}

// ─────────────────────────────────────────────────────────────────────────────
// Paquetes comerciales
// ─────────────────────────────────────────────────────────────────────────────

export interface SponsorPackage {
  code: string;
  name: string;
  monthlyPriceUsdFrom: number;
  slots: string[];
  impressionsIncluded: number | null;
  reporting: string[];
  restrictions: string[];
  description: string;
}

/** Precios de referencia. Configurables desde el panel administrativo. */
export const SPONSOR_PACKAGES: SponsorPackage[] = [
  {
    code: 'starter-sponsor',
    name: 'Starter Sponsor',
    monthlyPriceUsdFrom: 300,
    slots: ['dashboard-side'],
    impressionsIncluded: 150_000,
    reporting: ['Impresiones', 'Clics', 'CTR', 'Reporte mensual'],
    restrictions: ['Una ubicación secundaria', 'Segmentación por página'],
    description: 'Presencia estable en una ubicación secundaria, con reporte mensual y segmentación por página.',
  },
  {
    code: 'market-sponsor',
    name: 'Market Sponsor',
    monthlyPriceUsdFrom: 750,
    slots: ['dashboard-banner', 'news-native'],
    impressionsIncluded: 500_000,
    reporting: ['Impresiones', 'Clics', 'CTR', 'Viewability', 'Reporte mensual'],
    restrictions: ['Segmentación por mercado de interés', 'Identificación visible como patrocinador'],
    description: 'Banner principal más tarjeta nativa, con segmentación por mercado y reporte de viewability.',
  },
  {
    code: 'academy-partner',
    name: 'Academy Partner',
    monthlyPriceUsdFrom: 1500,
    slots: ['lesson-sponsor', 'academy-footer'],
    impressionsIncluded: null,
    reporting: ['Impresiones', 'Clics', 'CTR', 'Alcance por ruta', 'Reporte mensual'],
    restrictions: [
      'Patrocinio de una ruta educativa completa',
      'Mensaje institucional sujeto a aprobación editorial',
      'Prohibido intervenir en el contenido, en las evaluaciones o en las recomendaciones',
    ],
    description: 'Patrocinio de una ruta educativa con logotipo en portada y banner secundario, sin injerencia editorial.',
  },
];

export const PRICING_MODEL_LABEL: Record<string, string> = {
  CPM: 'Coste por mil impresiones',
  CPC: 'Coste por clic',
  FLAT_MONTHLY: 'Patrocinio mensual a precio fijo',
  FLAT_CAMPAIGN: 'Precio fijo por campaña',
};
