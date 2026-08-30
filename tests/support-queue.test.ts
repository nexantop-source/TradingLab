import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({
  db: { supportTicket: { findMany: mocks.findMany } },
}));

import { prioritizedSupportTickets } from '../src/lib/support-queue';

describe('cola priorizada de soporte', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mantiene visible un ticket HIGH abierto aunque existan más de 60 normales recientes', async () => {
    const critical = {
      id: 'ticket_wompi_critical',
      priority: 'HIGH',
      status: 'OPEN',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { email: 'masked@example.test', name: 'Cuenta de prueba' },
    };
    const normal = Array.from({ length: 60 }, (_, index) => ({
      id: `ticket_normal_${index}`,
      priority: 'NORMAL',
      status: 'OPEN',
      createdAt: new Date(2026, 7, 29, 12, index),
      user: { email: 'masked@example.test', name: 'Cuenta de prueba' },
    }));
    mocks.findMany.mockResolvedValueOnce([critical]).mockResolvedValueOnce(normal.slice(0, 59));

    const tickets = await prioritizedSupportTickets(60);

    expect(tickets).toHaveLength(60);
    expect(tickets[0]).toBe(critical);
    expect(mocks.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { priority: 'HIGH', status: 'OPEN' },
        take: 60,
      }),
    );
    expect(mocks.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 59 }),
    );
  });
});
