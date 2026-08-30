/**
 * Primitivas criptográficas del servidor de anuncios. Este módulo no se
 * importa desde componentes cliente, para que ni siquiera el acceso a la
 * variable del secreto forme parte del grafo del navegador.
 */

export const AD_EVENT_TOKEN_VERSION = 1 as const;
export const AD_EVENT_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export interface AdEventTokenClaims {
  v: typeof AD_EVENT_TOKEN_VERSION;
  aud: 'tradinglab-ad-event';
  jti: string;
  creativeId: string;
  campaignId: string;
  slotCode: string;
  page: string;
  viewer: string;
  iat: number;
  exp: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importHmacKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error('ADS_EVENT_TOKEN_SECRET debe tener al menos 32 caracteres.');
  return crypto.subtle.importKey('raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usage);
}

function validClaims(value: unknown): value is AdEventTokenClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.v === AD_EVENT_TOKEN_VERSION &&
    claims.aud === 'tradinglab-ad-event' &&
    typeof claims.jti === 'string' &&
    /^[A-Za-z0-9-]{20,80}$/.test(claims.jti) &&
    typeof claims.creativeId === 'string' &&
    claims.creativeId.length > 0 &&
    claims.creativeId.length <= 100 &&
    typeof claims.campaignId === 'string' &&
    claims.campaignId.length > 0 &&
    claims.campaignId.length <= 100 &&
    typeof claims.slotCode === 'string' &&
    /^[A-Za-z0-9_-]{1,60}$/.test(claims.slotCode) &&
    typeof claims.page === 'string' &&
    /^[A-Za-z0-9/_-]{1,120}$/.test(claims.page) &&
    typeof claims.viewer === 'string' &&
    /^[A-Za-z0-9_-]{16,64}$/.test(claims.viewer) &&
    typeof claims.iat === 'number' &&
    Number.isSafeInteger(claims.iat) &&
    typeof claims.exp === 'number' &&
    Number.isSafeInteger(claims.exp) &&
    claims.exp > claims.iat &&
    claims.exp - claims.iat <= AD_EVENT_TOKEN_TTL_MS
  );
}

export function adEventSecretConfigured(): boolean {
  return Boolean(process.env.ADS_EVENT_TOKEN_SECRET && process.env.ADS_EVENT_TOKEN_SECRET.length >= 32);
}

export async function adViewerBinding(secret: string, source: string): Promise<string> {
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(`viewer:${source}`));
  return encodeBase64Url(new Uint8Array(signature)).slice(0, 32);
}

export async function issueAdEventToken(
  secret: string,
  input: Omit<AdEventTokenClaims, 'v' | 'aud' | 'jti' | 'iat' | 'exp'>,
  now = Date.now(),
): Promise<string> {
  const claims: AdEventTokenClaims = {
    ...input,
    v: AD_EVENT_TOKEN_VERSION,
    aud: 'tradinglab-ad-event',
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + AD_EVENT_TOKEN_TTL_MS,
  };
  const payload = encodeBase64Url(textEncoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return `${payload}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdEventToken(
  secret: string,
  token: string,
  expectedViewer: string,
  now = Date.now(),
): Promise<AdEventTokenClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const payloadBytes = decodeBase64Url(parts[0]);
  const signature = decodeBase64Url(parts[1]);
  if (!payloadBytes || !signature) return null;

  try {
    const key = await importHmacKey(secret, ['verify']);
    const signatureBuffer = signature.slice().buffer as ArrayBuffer;
    const authentic = await crypto.subtle.verify('HMAC', key, signatureBuffer, textEncoder.encode(parts[0]));
    if (!authentic) return null;
    const claims: unknown = JSON.parse(textDecoder.decode(payloadBytes));
    if (!validClaims(claims)) return null;
    if (claims.viewer !== expectedViewer || claims.iat > now + 60_000 || claims.exp <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

type ReplayRegistry = Map<string, number>;
const replayGlobal = globalThis as typeof globalThis & { __tlAdEventReplay?: ReplayRegistry };

function replayRegistry(): ReplayRegistry {
  replayGlobal.__tlAdEventReplay ??= new Map<string, number>();
  return replayGlobal.__tlAdEventReplay;
}

/**
 * Defensa de repetición por proceso. En un despliegue multi-instancia debe
 * complementarse con una clave UNIQUE persistente (documentado en ADS.md).
 */
export function claimAdEventOnce(key: string, expiresAt: number, now = Date.now()): boolean {
  const registry = replayRegistry();
  if (registry.size >= 5_000) {
    for (const [candidate, expiry] of registry) if (expiry <= now) registry.delete(candidate);
  }
  while (registry.size >= 10_000) {
    const oldest = registry.keys().next().value as string | undefined;
    if (!oldest) break;
    registry.delete(oldest);
  }
  const existing = registry.get(key);
  if (existing && existing > now) return false;
  registry.set(key, expiresAt);
  return true;
}

/** Libera una reserva cuando la escritura falla, para permitir un reintento legítimo. */
export function releaseAdEventClaim(key: string): void {
  replayRegistry().delete(key);
}
