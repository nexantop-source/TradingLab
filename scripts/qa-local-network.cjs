// Test-process preload: no outbound fetches except fixed local QA origins.
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['http://127.0.0.1:3010', 'https://127.0.0.1:3443'].includes(url.origin)) throw new Error('QA_EXTERNAL_NETWORK_BLOCKED');
  return originalFetch(input, init);
};
