import { describe, expect, it } from 'vitest';
import { resolveActivePlan } from '../src/lib/active-plan';

const now = new Date('2026-09-05T12:00:00Z');
const active = { planId: 'STANDARD', status: 'ACTIVE', currentPeriodEnd: new Date('2026-10-05T12:00:00Z') };
describe('automatic free access', () => {
  it('is available without any subscription record', () => { expect(resolveActivePlan(null, now)).toBe('FREE'); expect(resolveActivePlan(undefined, now)).toBe('FREE'); });
  it('retains paid access until the exact end of its period', () => { expect(resolveActivePlan(active, now)).toBe('STANDARD'); expect(resolveActivePlan({ ...active, planId: 'PREMIUM' }, now)).toBe('PREMIUM'); });
  it('returns to Free automatically on expiration', () => { expect(resolveActivePlan(active, active.currentPeriodEnd)).toBe('FREE'); expect(resolveActivePlan({ ...active, currentPeriodEnd: new Date('2026-09-04') }, now)).toBe('FREE'); });
  it.each(['CANCELED', 'PAST_DUE', 'EXPIRED', 'PENDING'])('does not grant paid access for %s', status => { expect(resolveActivePlan({ ...active, status }, now)).toBe('FREE'); });
  it('preserves a valid trial', () => { expect(resolveActivePlan({ ...active, status: 'TRIALING' }, now)).toBe('STANDARD'); });
  it('does not grant an unknown plan', () => { expect(resolveActivePlan({ ...active, planId: 'UNRECOGNIZED' }, now)).toBe('FREE'); });
  it('fails closed for an invalid expiration date', () => { expect(resolveActivePlan({ ...active, currentPeriodEnd: new Date('invalid') }, now)).toBe('FREE'); });
});
