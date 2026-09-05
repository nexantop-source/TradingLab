/** Only the official hosted checkout can be opened or copied from our UI. */
export function safeWompiCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (url.origin !== 'https://checkout.wompi.co' || url.pathname !== '/p/' || url.username || url.password) {
    throw new Error('Destino de checkout no permitido');
  }
  return url.toString();
}
