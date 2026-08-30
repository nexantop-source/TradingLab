import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { resolveBillingProviderId } from '../src/lib/billing';
import { WompiError } from '../src/lib/wompi';
import { formatPaymentDescription } from '../src/lib/format';

describe('selección segura del proveedor de pagos', () => {
  it('falla cerrada por defecto en producción', () => {
    expect(resolveBillingProviderId({ NODE_ENV: 'production' })).toBe('disabled');
  });

  it('prohíbe explícitamente el proveedor mock en producción', () => {
    expect(() =>
      resolveBillingProviderId({ NODE_ENV: 'production', BILLING_PROVIDER: 'mock' }),
    ).toThrowError(WompiError);
  });

  it('mantiene mock disponible únicamente para desarrollo local', () => {
    expect(resolveBillingProviderId({ NODE_ENV: 'development', BILLING_PROVIDER: 'mock' })).toBe('mock');
  });
});

describe('presentación del historial de pagos', () => {
  it('oculta el sufijo técnico sin modificar la descripción comercial', () => {
    expect(
      formatPaymentDescription(
        'Suscripción Standard (mensual) [tl:wompi:v1:STANDARD:MONTHLY]',
      ),
    ).toBe('Suscripción Standard (mensual)');
  });
});
