import { describe, expect, it } from 'vitest';
import { PAYMENT_REGION_NOTICE, PAYMENT_REFERENCE_NOTICE } from '../src/lib/payment-copy';

describe('payment currency copy', () => {
  it('identifies Colombia, Wompi and the charge currency without asserting a completed payment', () => {
    expect(PAYMENT_REGION_NOTICE).toContain('Colombia');
    expect(PAYMENT_REGION_NOTICE).toContain('Al pagar con Wompi');
    expect(PAYMENT_REGION_NOTICE).toContain('pesos colombianos (COP)');
    expect(PAYMENT_REGION_NOTICE).toContain('antes de confirmar');
  });
  it('distinguishes reference pricing from a real COP charge and a trading deposit', () => {
    expect(PAYMENT_REFERENCE_NOTICE).toContain('USD son de referencia');
    expect(PAYMENT_REFERENCE_NOTICE).toContain('se presenta en COP');
    expect(PAYMENT_REFERENCE_NOTICE).toContain('no es un depósito para invertir');
  });
});
