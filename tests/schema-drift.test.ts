import { describe, expect, it, vi } from 'vitest';

/**
 * Una base desplegada que se queda atrás del esquema rompe **toda** petición
 * autenticada, porque `getAuth` carga el perfil y la suscripción enteros. El
 * síntoma es una aplicación en blanco tras iniciar sesión, y en producción Next
 * oculta el mensaje del servidor.
 *
 * Estas pruebas fijan que el fallo se identifique como problema de despliegue
 * y no como un 500 opaco, y que el mensaje diga qué ejecutar.
 */

vi.mock('server-only', () => ({}));
vi.mock('../src/lib/db', () => ({ db: {} }));

const { handleError } = await import('../src/lib/api');

function prismaError(code: string, message: string) {
  return Object.assign(new Error(message), { code, name: 'PrismaClientKnownRequestError' });
}

async function readBody(response: Response) {
  return (await response.json()) as { ok: boolean; error: { code: string; message: string } };
}

describe('desfase de esquema', () => {
  it.each([
    ['P2022', 'The column `main.Profile.studyReminderOptIn` does not exist in the current database.'],
    ['P2021', 'The table `main.PushSubscription` does not exist in the current database.'],
  ])('traduce %s a un 503 accionable', async (code, message) => {
    const response = handleError(prismaError(code, message));
    expect(response.status).toBe(503);
    const body = await readBody(response);
    expect(body.error.code).toBe('DATABASE_SCHEMA_OUTDATED');
    // El mensaje tiene que decir el comando, no solo que algo va mal.
    expect(body.error.message).toContain('db-remote.mjs push');
  });

  it('lo reconoce también sin código, por el mensaje', async () => {
    const response = handleError(new Error('column Subscription.source does not exist'));
    expect(response.status).toBe(503);
    expect((await readBody(response)).error.code).toBe('DATABASE_SCHEMA_OUTDATED');
  });

  it('no confunde un error de consulta corriente con un desfase', async () => {
    const response = handleError(prismaError('P2002', 'Unique constraint failed on the fields: (`email`)'));
    expect(response.status).toBe(500);
    expect((await readBody(response)).error.code).toBe('INTERNAL_ERROR');
  });

  it('sigue distinguiendo la falta de conexión del desfase de esquema', async () => {
    const response = handleError(
      Object.assign(new Error('Can\'t reach database server'), { name: 'PrismaClientInitializationError' }),
    );
    expect(response.status).toBe(503);
    expect((await readBody(response)).error.code).toBe('DATABASE_NOT_CONFIGURED');
  });
});

describe('aviso en el registro del servidor', () => {
  it('getAuth deja constancia del comando que hay que ejecutar', async () => {
    // En una página de servidor no interviene `handleError`, así que el aviso
    // tiene que salir donde sí se lee: el registro.
    const source = await import('node:fs').then((fs) =>
      fs.readFileSync('src/lib/auth.ts', 'utf8'),
    );
    expect(source).toContain('db-remote.mjs push');
    expect(source).toMatch(/P2021|P2022/);
  });
});
