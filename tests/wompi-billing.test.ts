import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildWompiCheckoutUrl,
  parseWompiWebhookEvent,
  readWompiConfig,
  verifyWompiEventSignature,
  wompiAmountInCents,
  wompiEventFingerprint,
  wompiIntegritySignature,
  wompiReference,
  WompiError,
} from '../src/lib/wompi';

const DOCS_EVENTS_SECRET = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';

function docsEvent(overrides: Record<string, unknown> = {}) {
  return {
    event: 'transaction.updated',
    data: {
      transaction: {
        id: '1234-1610641025-49201',
        amount_in_cents: 4_490_000,
        reference: 'MZQ3X2DE2SMX',
        currency: 'COP',
        status: 'APPROVED',
      },
    },
    environment: 'prod',
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      // Hash conocido para los valores del ejemplo y el secreto de fixture.
      checksum: '5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE',
    },
    timestamp: 1_530_291_411,
    sent_at: '2018-07-20T16:45:05.000Z',
    ...overrides,
  };
}

describe('Wompi checkout', () => {
  it('genera la firma de integridad documentada por Wompi', () => {
    expect(
      wompiIntegritySignature(
        'sk8-438k4-xmxm392-sn2m',
        2_490_000,
        'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
      ),
    ).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  it('construye Checkout Web con COP y no expone el secreto de integridad', () => {
    const secret = 'test_integrity_secret-that-must-not-leak';
    const checkout = new URL(
      buildWompiCheckoutUrl({
        publicKey: 'pub_test_public-value',
        integritySecret: secret,
        reference: 'tl_reference_123456',
        amountInCents: 5_990_000,
        redirectUrl: 'https://tradinglab.example/perfil?checkout=wompi',
      }),
    );

    expect(checkout.origin + checkout.pathname).toBe('https://checkout.wompi.co/p/');
    expect(checkout.searchParams.get('currency')).toBe('COP');
    expect(checkout.searchParams.get('amount-in-cents')).toBe('5990000');
    expect(checkout.searchParams.get('signature:integrity')).toMatch(/^[a-f0-9]{64}$/);
    expect(checkout.toString()).not.toContain(secret);
  });

  it('incluye expiration-time dentro de la firma y de la URL', () => {
    const expirationTime = '2030-06-09T20:28:50.000Z';
    const secret = 'test_integrity_expiration-secret';
    const checkout = new URL(
      buildWompiCheckoutUrl({
        publicKey: 'pub_test_public-value',
        integritySecret: secret,
        reference: 'tl_expiration_123456',
        amountInCents: 5_990_000,
        redirectUrl: 'https://tradinglab.example/perfil?checkout=wompi',
        expirationTime,
      }),
    );

    expect(checkout.searchParams.get('expiration-time')).toBe(expirationTime);
    expect(checkout.searchParams.get('signature:integrity')).toBe(
      createHash('sha256')
        .update(`tl_expiration_1234565990000COP${expirationTime}${secret}`)
        .digest('hex'),
    );
  });

  it('deriva referencias opacas estables y separadas por usuario', () => {
    const a = wompiReference('user-a', 'client-key-123', 'integrity-secret');
    expect(a).toBe(wompiReference('user-a', 'client-key-123', 'integrity-secret'));
    expect(a).not.toBe(wompiReference('user-b', 'client-key-123', 'integrity-secret'));
    expect(a).not.toContain('user-a');
  });

  it('solo acepta importes enteros positivos definidos por servidor', () => {
    expect(
      wompiAmountInCents('STANDARD', 'MONTHLY', {
        WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS: '5990000',
      }),
    ).toBe(5_990_000);
    expect(() =>
      wompiAmountInCents('STANDARD', 'MONTHLY', {
        WOMPI_STANDARD_MONTHLY_AMOUNT_IN_CENTS: '59900.50',
      }),
    ).toThrow(WompiError);
  });

  it('bloquea credenciales de sandbox declaradas como producción', () => {
    expect(() =>
      readWompiConfig({
        WOMPI_ENVIRONMENT: 'production',
        WOMPI_PUBLIC_KEY: 'pub_test_not-production',
      }),
    ).toThrowError(/no pertenece al ambiente production/);
  });

  it('exige el prefijo oficial completo en credenciales de producción', () => {
    expect(() =>
      readWompiConfig({
        WOMPI_ENVIRONMENT: 'production',
        WOMPI_PUBLIC_KEY: 'pub_custom_not-a-production-key',
      }),
    ).toThrowError(/no pertenece al ambiente production/);

    expect(
      readWompiConfig({
        WOMPI_ENVIRONMENT: 'production',
        WOMPI_PUBLIC_KEY: 'pub_prod_public-value',
      }).publicKey,
    ).toBe('pub_prod_public-value');
  });
});

describe('Wompi webhook', () => {
  it('valida la estructura oficial respetando properties dinámicas y mayúsculas', () => {
    const event = parseWompiWebhookEvent(JSON.stringify(docsEvent()));
    expect(verifyWompiEventSignature(event, DOCS_EVENTS_SECRET, event.signature.checksum)).toBe(true);
  });

  it('exige que X-Event-Checksum coincida con el checksum del cuerpo', () => {
    const event = parseWompiWebhookEvent(JSON.stringify(docsEvent()));
    expect(verifyWompiEventSignature(event, DOCS_EVENTS_SECRET, '0'.repeat(64))).toBe(false);
  });

  it('rechaza un evento de transacción cuyo identificador no esté firmado', () => {
    const payload = docsEvent({
      signature: {
        properties: ['transaction.status', 'transaction.amount_in_cents'],
        checksum: createHash('sha256')
          .update(`APPROVED4490000${1_530_291_411}${DOCS_EVENTS_SECRET}`)
          .digest('hex'),
      },
    });
    const event = parseWompiWebhookEvent(JSON.stringify(payload));
    expect(verifyWompiEventSignature(event, DOCS_EVENTS_SECRET, null)).toBe(false);
  });

  it('rechaza rutas de firma duplicadas aunque el checksum coincida', () => {
    const payload = docsEvent({
      signature: {
        properties: ['transaction.id', 'transaction.id'],
        checksum: createHash('sha256')
          .update(`1234-1610641025-492011234-1610641025-49201${1_530_291_411}${DOCS_EVENTS_SECRET}`)
          .digest('hex'),
      },
    });
    const event = parseWompiWebhookEvent(JSON.stringify(payload));
    expect(verifyWompiEventSignature(event, DOCS_EVENTS_SECRET, null)).toBe(false);
  });

  it('rechaza rutas peligrosas aunque el hash aportado coincida', () => {
    const payload = docsEvent({
      signature: {
        properties: ['transaction.__proto__.polluted'],
        checksum: createHash('sha256')
          .update(`anything${1_530_291_411}${DOCS_EVENTS_SECRET}`)
          .digest('hex'),
      },
    });
    const event = parseWompiWebhookEvent(JSON.stringify(payload));
    expect(verifyWompiEventSignature(event, DOCS_EVENTS_SECRET, null)).toBe(false);
    expect(({} as { polluted?: unknown }).polluted).toBeUndefined();
  });

  it('aplica esquema estricto al sobre del evento', () => {
    expect(() =>
      parseWompiWebhookEvent(JSON.stringify({ ...docsEvent(), unexpected: 'field' })),
    ).toThrow(WompiError);
  });

  it('genera una huella estable que cambia con el estado firmado', () => {
    const approved = parseWompiWebhookEvent(JSON.stringify(docsEvent()));
    expect(wompiEventFingerprint(approved)).toBe(wompiEventFingerprint(approved));

    const errorData = docsEvent().data;
    errorData.transaction.status = 'ERROR';
    const errorChecksum = createHash('sha256')
      .update(
        `${errorData.transaction.id}${errorData.transaction.status}${errorData.transaction.amount_in_cents}${1_530_291_411}${DOCS_EVENTS_SECRET}`,
      )
      .digest('hex');
    const errored = parseWompiWebhookEvent(
      JSON.stringify(
        docsEvent({
          data: errorData,
          signature: {
            properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
            checksum: errorChecksum,
          },
        }),
      ),
    );
    expect(wompiEventFingerprint(errored)).not.toBe(wompiEventFingerprint(approved));
  });
});
