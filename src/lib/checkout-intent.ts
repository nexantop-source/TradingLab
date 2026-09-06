export type CheckoutPlan = 'STANDARD' | 'PREMIUM';
export type CheckoutInterval = 'MONTHLY' | 'YEARLY';

export interface CheckoutIntent {
  plan: CheckoutPlan;
  interval: CheckoutInterval;
}

/**
 * Convierte parámetros no confiables en una intención de compra cerrada.
 * Solo admite las cuatro combinaciones que el servidor de billing acepta.
 */
export function parseCheckoutIntent(input: {
  plan?: string | string[];
  interval?: string | string[];
}): CheckoutIntent | null {
  const plan = Array.isArray(input.plan) ? input.plan[0] : input.plan;
  const interval = Array.isArray(input.interval) ? input.interval[0] : input.interval;

  if (plan !== 'STANDARD' && plan !== 'PREMIUM') return null;
  if (interval !== 'MONTHLY' && interval !== 'YEARLY') return null;
  return { plan, interval };
}

export function checkoutQuery(intent: CheckoutIntent | null): string {
  if (!intent) return '';
  return `?plan=${intent.plan}&interval=${intent.interval}`;
}

export function checkoutPath(intent: CheckoutIntent): string {
  return `/pago${checkoutQuery(intent)}`;
}

export function onboardingPath(intent: CheckoutIntent | null): string {
  return `/onboarding${checkoutQuery(intent)}`;
}

/** Fixed same-origin destinations only, even if the login response is malformed. */
export function postLoginPath(next: string, intent: CheckoutIntent | null): string {
  if (next === '/onboarding') return onboardingPath(intent);
  return intent ? checkoutPath(intent) : '/panel';
}
