import 'server-only';
import { readWompiConfig, wompiAmountInCents, WompiError } from './wompi';
import { currentTrm } from './cop-exchange';

/**
 * Qué le falta exactamente a los pagos para funcionar.
 *
 * Antes esto era una sola frase: «Wompi está seleccionado, pero faltan
 * credenciales, precios o una URL HTTPS válida». Tres causas distintas bajo un
 * mismo mensaje, y ninguna forma de saber cuál. El despliegue llevaba días con
 * los pagos degradados y nadie podía decir por qué sin leer el código y
 * adivinar.
 *
 * El mismo error costó caro con los datos de mercado: el fallo estaba a la
 * vista y era ilegible. Aquí se comprueba cada pieza por separado y se dice
 * cuál falla, con el nombre de la variable que hay que rellenar.
 *
 * No expone ningún secreto: dice si algo está puesto, nunca qué vale.
 */

export interface BillingCheck {
  /** Nombre corto de la pieza, para leer de un vistazo. */
  name: string;
  ok: boolean;
  /** Qué pasa y, si falla, qué hay que hacer. */
  detail: string;
}

export interface BillingReadiness {
  provider: string;
  ready: boolean;
  checks: BillingCheck[];
}

export async function billingReadiness(env: NodeJS.ProcessEnv = process.env): Promise<BillingReadiness> {
  const provider = (env.BILLING_PROVIDER ?? 'disabled').trim().toLowerCase();
  if (provider !== 'wompi') {
    return {
      provider,
      ready: provider === 'mock',
      checks: [
        {
          name: 'Proveedor',
          ok: provider === 'mock',
          detail:
            provider === 'mock'
              ? 'Pasarela simulada de desarrollo: no se procesan cargos reales.'
              : 'Pagos deshabilitados de forma segura. Pon BILLING_PROVIDER=wompi para activarlos.',
        },
      ],
    };
  }

  const checks: BillingCheck[] = [];

  // ── Credenciales ──────────────────────────────────────────────────────────
  let environment: string | null = null;
  try {
    const config = readWompiConfig(env, { requireIntegrity: true, requireEvents: true });
    environment = config.environment;
    checks.push({
      name: 'Credenciales',
      ok: true,
      detail: `Llaves de ${config.environment} completas: pública, privada, integridad y eventos.`,
    });
  } catch (error) {
    checks.push({
      name: 'Credenciales',
      ok: false,
      // El mensaje de `readWompiConfig` ya nombra la variable que falla y
      // comprueba que el prefijo case con el ambiente: una llave de pruebas en
      // producción se rechaza en el arranque, no en el primer cobro.
      detail: error instanceof WompiError ? error.message : 'No se pudieron leer las credenciales de Wompi.',
    });
  }

  // ── Precio ────────────────────────────────────────────────────────────────
  // Cada modo necesita cosas distintas, y exigirle a uno lo del otro era el
  // fallo que dejaba el despliegue en amarillo sin motivo real: con `usd_trm`
  // el importe sale del precio en dólares por la tasa del día, así que los
  // cuatro importes fijos en pesos no pintan nada.
  const mode = (env.WOMPI_PRICING_MODE ?? 'fixed_cop').trim();
  if (mode === 'usd_trm') {
    try {
      const rate = await currentTrm();
      checks.push({
        name: 'Precio',
        ok: true,
        detail: `El importe se calcula con la TRM del día (${(rate.rateHundredths / 100).toLocaleString('es-CO')} COP por dólar).`,
      });
    } catch {
      checks.push({
        name: 'Precio',
        ok: false,
        detail:
          'Modo usd_trm, pero la TRM oficial no responde ahora mismo. Mientras dure, no se puede ' +
          'calcular el importe en pesos y no se abren pruebas ni cobros.',
      });
    }
  } else {
    const missing: string[] = [];
    for (const plan of ['STANDARD', 'PREMIUM'] as const) {
      for (const interval of ['MONTHLY', 'YEARLY'] as const) {
        try {
          wompiAmountInCents(plan, interval, env);
        } catch {
          missing.push(`WOMPI_${plan}_${interval}_AMOUNT_IN_CENTS`);
        }
      }
    }
    checks.push({
      name: 'Precio',
      ok: missing.length === 0,
      detail: missing.length === 0
        ? 'Los cuatro importes en pesos están declarados.'
        : `Modo fixed_cop: falta declarar ${missing.join(', ')}.`,
    });
  }

  // ── Dirección pública ─────────────────────────────────────────────────────
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? '').trim();
  let urlOk = false;
  try {
    urlOk = new URL(appUrl).protocol === 'https:';
  } catch {
    urlOk = false;
  }
  checks.push({
    name: 'Dirección pública',
    ok: urlOk,
    detail: urlOk
      ? `Wompi devolverá a ${appUrl} tras el pago.`
      : appUrl
        ? `NEXT_PUBLIC_APP_URL es "${appUrl}" y tiene que ser una dirección https.`
        : 'Falta NEXT_PUBLIC_APP_URL. Sin ella, Wompi no sabe a dónde devolver a la persona.',
  });

  // ── Cobro al vencer ───────────────────────────────────────────────────────
  // Se comprueba aquí porque su ausencia no produce ningún síntoma: las pruebas
  // vencen, nadie cobra y nadie se queja de que no le cobren.
  const dispatch = (env.PUSH_DISPATCH_SECRET ?? '').trim();
  checks.push({
    name: 'Cobro al vencer',
    ok: dispatch.length >= 32,
    detail: dispatch.length >= 32
      ? 'Credencial del programador puesta. Falta comprobar que el trabajo de Cloud Scheduler lo esté invocando.'
      : 'Sin PUSH_DISPATCH_SECRET (32 caracteres o más) la ruta de cobro responde 503 y ninguna prueba convierte.',
  });

  return {
    provider: environment ? `wompi (${environment})` : 'wompi',
    ready: checks.every((check) => check.ok),
    checks,
  };
}
