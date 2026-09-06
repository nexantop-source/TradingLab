import { describe, expect, it } from 'vitest';
import { postLoginPath, type CheckoutIntent } from '../src/lib/checkout-intent';

describe('fresh-document post-login destination', () => {
  it('keeps the server onboarding gate', () => {
    expect(postLoginPath('/onboarding', null)).toBe('/onboarding');
    expect(postLoginPath('/panel', null)).toBe('/panel');
  });
  it.each<CheckoutIntent>([
    { plan: 'STANDARD', interval: 'MONTHLY' },
    { plan: 'STANDARD', interval: 'YEARLY' },
    { plan: 'PREMIUM', interval: 'MONTHLY' },
    { plan: 'PREMIUM', interval: 'YEARLY' },
  ])('retains the selected subscription %j', intent => {
    const query = `?plan=${intent.plan}&interval=${intent.interval}`;
    expect(postLoginPath('/onboarding', intent)).toBe(`/onboarding${query}`);
    expect(postLoginPath('/panel', intent)).toBe(`/pago${query}`);
  });
  it.each(['https://external.invalid', '//external.invalid', '/onboarding/../outside', 'javascript:alert(1)'])('never follows an arbitrary destination %s', destination => {
    expect(postLoginPath(destination, null)).toBe('/panel');
  });
});
