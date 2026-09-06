import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAN_ENTITLEMENTS } from '../src/packages/types/plans';

/**
 * Un certificado que no cuesta nada no acredita nada. Estas pruebas fijan
 * cuándo se emite, quién lo obtiene verificable y qué se expone a un tercero.
 */

vi.mock('server-only', () => ({}));

const track = vi.hoisted(() => ({ findMany: vi.fn() }));
const userProgress = vi.hoisted(() => ({ findMany: vi.fn() }));
const certificate = vi.hoisted(() => ({ findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() }));

vi.mock('../src/lib/db', () => ({ db: { track, userProgress, certificate } }));

const { issueEarnedCertificates, issueVerificationCode, verifyCertificate } = await import(
  '../src/lib/certificates'
);

function ruta(slug: string, lessonIds: string[]) {
  return {
    slug,
    title: `Ruta ${slug}`,
    courses: [{ modules: [{ lessons: lessonIds.map((id) => ({ id })) }] }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  certificate.findMany.mockResolvedValue([]);
  certificate.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...data,
    issuedAt: new Date('2026-09-06T00:00:00Z'),
  }));
});

describe('diferenciación de planes', () => {
  it('el certificado es la capacidad que separa Plus de Pro', () => {
    expect(PLAN_ENTITLEMENTS.FREE.features.certificates).toBe('none');
    expect(PLAN_ENTITLEMENTS.STANDARD.features.certificates).toBe('standard');
    expect(PLAN_ENTITLEMENTS.PREMIUM.features.certificates).toBe('verified');
  });

  it('Plus y Pro ya no tienen la misma matriz de capacidades', () => {
    // Era el problema de fondo: Pro costaba el doble y solo cambiaban cuotas.
    expect(PLAN_ENTITLEMENTS.STANDARD.features).not.toEqual(PLAN_ENTITLEMENTS.PREMIUM.features);
  });
});

describe('emisión', () => {
  it('no emite nada en el plan gratuito', async () => {
    expect(await issueEarnedCertificates('u1', 'FREE')).toEqual([]);
    expect(track.findMany).not.toHaveBeenCalled();
  });

  it('exige completar todas las lecciones de la ruta', async () => {
    track.findMany.mockResolvedValue([ruta('fundamentos', ['l1', 'l2', 'l3'])]);
    userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }, { lessonId: 'l2' }]);
    expect(await issueEarnedCertificates('u1', 'PREMIUM')).toEqual([]);
    expect(certificate.create).not.toHaveBeenCalled();
  });

  it('emite al completar la última lección', async () => {
    track.findMany.mockResolvedValue([ruta('fundamentos', ['l1', 'l2'])]);
    userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }, { lessonId: 'l2' }]);
    const [issued] = await issueEarnedCertificates('u1', 'PREMIUM');
    expect(issued.trackSlug).toBe('fundamentos');
    expect(issued.verified).toBe(true);
  });

  it('en Plus emite comprobante, no credencial verificable', async () => {
    track.findMany.mockResolvedValue([ruta('fundamentos', ['l1'])]);
    userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }]);
    const [issued] = await issueEarnedCertificates('u1', 'STANDARD');
    expect(issued.verified).toBe(false);
  });

  it('es idempotente: no duplica una ruta ya certificada', async () => {
    track.findMany.mockResolvedValue([ruta('fundamentos', ['l1'])]);
    userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }]);
    certificate.findMany.mockResolvedValue([{ trackSlug: 'fundamentos' }]);
    expect(await issueEarnedCertificates('u1', 'PREMIUM')).toEqual([]);
    expect(certificate.create).not.toHaveBeenCalled();
  });

  it('no certifica una ruta sin lecciones publicadas', async () => {
    track.findMany.mockResolvedValue([ruta('vacia', [])]);
    userProgress.findMany.mockResolvedValue([]);
    expect(await issueEarnedCertificates('u1', 'PREMIUM')).toEqual([]);
  });

  it('una colisión de código no tumba la emisión de las demás rutas', async () => {
    track.findMany.mockResolvedValue([ruta('a', ['l1']), ruta('b', ['l2'])]);
    userProgress.findMany.mockResolvedValue([{ lessonId: 'l1' }, { lessonId: 'l2' }]);
    certificate.create
      .mockRejectedValueOnce(new Error('unique constraint'))
      .mockResolvedValueOnce({ trackSlug: 'b', trackTitle: 'Ruta b', verificationCode: 'X', verified: true, issuedAt: new Date() });
    const issued = await issueEarnedCertificates('u1', 'PREMIUM');
    expect(issued.map((c) => c.trackSlug)).toEqual(['b']);
  });
});

describe('código de verificación', () => {
  it('se puede dictar por teléfono: sin vocales ni caracteres ambiguos', () => {
    for (let i = 0; i < 200; i++) {
      const code = issueVerificationCode();
      expect(code).toMatch(/^[0-9BCDFGHJKLMNPQRSTVWXYZ]{4}-[0-9BCDFGHJKLMNPQRSTVWXYZ]{4}-[0-9BCDFGHJKLMNPQRSTVWXYZ]{4}$/);
      expect(code).not.toMatch(/[AEIOU]/);
    }
  });

  it('no se repite en una muestra grande', () => {
    const codes = new Set(Array.from({ length: 2000 }, issueVerificationCode));
    expect(codes.size).toBe(2000);
  });
});

describe('comprobación pública', () => {
  it('solo confirma certificados verificables', async () => {
    certificate.findUnique.mockResolvedValue({
      trackTitle: 'Fundamentos',
      issuedAt: new Date('2026-09-06T00:00:00Z'),
      verified: false,
      user: { name: 'Alumna' },
    });
    // Un comprobante de finalización no es una credencial pública.
    expect(await verifyCertificate('ABCD-1234-BCDF')).toBeNull();
  });

  it('no expone correo, identificador ni plan de la cuenta', async () => {
    certificate.findUnique.mockResolvedValue({
      trackTitle: 'Fundamentos',
      issuedAt: new Date('2026-09-06T00:00:00Z'),
      verified: true,
      user: { name: 'Alumna' },
    });
    const result = await verifyCertificate('bcdf-1234-bcdf');
    expect(result).toEqual({
      holderName: 'Alumna',
      trackTitle: 'Fundamentos',
      issuedAt: new Date('2026-09-06T00:00:00Z'),
    });
    // El `select` es la barrera real: si alguien añade campos, esto avisa.
    const selected = certificate.findUnique.mock.calls[0][0].select;
    expect(selected.user.select).toEqual({ name: true });
    expect(selected.userId).toBeUndefined();
  });

  it('rechaza un código malformado sin consultar la base de datos', async () => {
    for (const bad of ['', 'x', '../../etc/passwd', "' OR 1=1 --", 'A'.repeat(50)]) {
      expect(await verifyCertificate(bad)).toBeNull();
    }
    expect(certificate.findUnique).not.toHaveBeenCalled();
  });

  it('acepta el código en minúsculas y con espacios sobrantes', async () => {
    certificate.findUnique.mockResolvedValue({
      trackTitle: 'Fundamentos',
      issuedAt: new Date(),
      verified: true,
      user: { name: 'Alumna' },
    });
    await verifyCertificate('  bcdf-1234-bcdf  ');
    expect(certificate.findUnique.mock.calls[0][0].where.verificationCode).toBe('BCDF-1234-BCDF');
  });
});
