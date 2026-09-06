import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * La academia sin conexión toca dos superficies delicadas: el único documento
 * que el service worker guarda en caché, y una ruta que entrega contenido de
 * pago para que viva en el dispositivo. Ambas se comprueban aquí.
 */

const offlinePage = readFileSync('public/offline.html', 'utf8');

describe('lector sin conexión', () => {
  it('no depende de ningún recurso externo', () => {
    // Es la única página disponible sin red: si pidiera una hoja de estilo, una
    // fuente o un script, no podría pintarse justo cuando hace falta.
    const external = offlinePage.match(/(?:src|href)\s*=\s*"([^"]+)"/g) ?? [];
    const remote = external.filter((attr) => !/"(\/app|#|data:)/.test(attr));
    expect(remote).toEqual([]);
    expect(offlinePage).not.toMatch(/<link[^>]+stylesheet/i);
    expect(offlinePage).not.toMatch(/<script[^>]+src=/i);
  });

  it('no lee la sesión ni habla con el servidor', () => {
    for (const forbidden of ['document.cookie', 'fetch(', 'XMLHttpRequest', 'localStorage', 'sessionStorage']) {
      expect(offlinePage).not.toContain(forbidden);
    }
  });

  it('abre IndexedDB sin crear el almacén, para no inventar una descarga', () => {
    // `open` sin versión no dispara `onupgradeneeded`: si la aplicación nunca
    // guardó nada, esta página lo detecta en lugar de crear un almacén vacío.
    expect(offlinePage).toContain('indexedDB.open(DB)');
    expect(offlinePage).not.toMatch(/onupgradeneeded\s*=/);
    expect(offlinePage).toContain('db.objectStoreNames.contains(STORE)');
    expect(offlinePage).toContain("'readonly'");
  });

  it('declara que el progreso y los gráficos siguen necesitando conexión', () => {
    expect(offlinePage).toContain('necesitan datos de mercado en vivo');
    expect(offlinePage).toContain('registrar tu progreso necesitas conexión');
  });
});

// ── Ruta de descarga ────────────────────────────────────────────────────────

vi.mock('server-only', () => ({}));

const lesson = vi.hoisted(() => ({ findMany: vi.fn() }));
const requireAuthMock = vi.hoisted(() => vi.fn());

vi.mock('../src/lib/db', () => ({ db: { lesson } }));
vi.mock('../src/lib/auth', () => ({ requireAuth: requireAuthMock }));

const { GET } = await import('../src/app/api/academy/offline/route');

function record(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'riesgo-por-operacion',
    title: 'Riesgo por operación',
    summary: 'Cuánto arriesgar en cada idea.',
    blocks: JSON.stringify([
      { type: 'text', body: 'El tamaño de la posición se decide antes de entrar.' },
      { type: 'chart', body: 'Observa el rango', symbol: 'BTCUSDT' },
    ]),
    estimatedMinutes: 9,
    position: 1,
    minPlan: 'FREE',
    module: { course: { title: 'Gestión del riesgo', published: true, track: { title: 'Fundamentos', published: true } } },
    ...overrides,
  };
}

async function body(plan: string) {
  requireAuthMock.mockResolvedValue({ user: { id: 'user-1', plan } });
  const response = await GET();
  return (await response.json()).data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('paquete descargable', () => {
  it('entrega solo las lecciones que el plan vigente permite leer', async () => {
    lesson.findMany.mockResolvedValue([
      record({ slug: 'gratis', minPlan: 'FREE' }),
      record({ slug: 'de-plus', minPlan: 'STANDARD' }),
      record({ slug: 'de-pro', minPlan: 'PREMIUM' }),
    ]);
    expect((await body('FREE')).lessons.map((l: { slug: string }) => l.slug)).toEqual(['gratis']);
    expect((await body('STANDARD')).lessons.map((l: { slug: string }) => l.slug)).toEqual(['gratis', 'de-plus']);
    expect((await body('PREMIUM')).lessons.map((l: { slug: string }) => l.slug)).toEqual([
      'gratis',
      'de-plus',
      'de-pro',
    ]);
  });

  it('excluye rutas y cursos despublicados', async () => {
    lesson.findMany.mockResolvedValue([
      record({ slug: 'curso-oculto', module: { course: { title: 'C', published: false, track: { title: 'T', published: true } } } }),
      record({ slug: 'ruta-oculta', module: { course: { title: 'C', published: true, track: { title: 'T', published: false } } } }),
      record({ slug: 'visible' }),
    ]);
    expect((await body('PREMIUM')).lessons.map((l: { slug: string }) => l.slug)).toEqual(['visible']);
  });

  it('no sirve los bloques de gráfico, pero declara cuántos faltan', async () => {
    lesson.findMany.mockResolvedValue([record()]);
    const [entry] = (await body('FREE')).lessons;
    expect(entry.blocks).toHaveLength(1);
    expect(entry.blocks[0].type).toBe('text');
    expect(entry.liveBlocks).toBe(1);
  });

  it('identifica la descarga sin exponer el identificador de la cuenta', async () => {
    lesson.findMany.mockResolvedValue([record()]);
    const scope = (await body('FREE')).scope;
    expect(scope).toMatch(/^[0-9a-f]{16}$/);
    expect(scope).not.toContain('user-1');
  });

  it('cambia el ámbito cuando cambia el plan, para no dejar contenido de más', async () => {
    lesson.findMany.mockResolvedValue([record()]);
    const free = (await body('FREE')).scope;
    const pro = (await body('PREMIUM')).scope;
    expect(free).not.toBe(pro);
  });

  it('nunca incluye progreso, cuestionarios ni datos de la cuenta', async () => {
    lesson.findMany.mockResolvedValue([record()]);
    const payload = await body('PREMIUM');
    const serialized = JSON.stringify(payload);
    for (const leak of ['quiz', 'correctIndex', 'progress', 'user-1']) {
      expect(serialized).not.toContain(leak);
    }
    // El `select` de Prisma es la barrera: si alguien añade campos, esto avisa.
    const selected = Object.keys(lesson.findMany.mock.calls[0][0].select);
    expect(selected).not.toContain('quiz');
    expect(selected).not.toContain('progress');
  });
});
