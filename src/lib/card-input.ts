
/** Typo checks only. Bank authorization remains a server/Wompi responsibility. */
export function cardInputError(number: string, expiry: string, cvc: string, holder: string, now = new Date()): string | null {
  const pan = number.replace(/\s/g, '');
  if (!/^\d{13,19}$/.test(pan) || /^(\d)\1+$/.test(pan)) return 'Revisa el número de la tarjeta.';
  let sum = 0;
  let double = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let digit = Number(pan[i]);
    if (double) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; double = !double;
  }
  if (sum % 10) return 'Revisa el número de la tarjeta.';
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Usa MM/AA para el vencimiento.';
  const [month, year] = expiry.split('/').map(Number);
  if (month < 1 || month > 12 || 2000 + year < now.getFullYear() || (2000 + year === now.getFullYear() && month < now.getMonth() + 1)) return 'La tarjeta está vencida o la fecha no es válida.';
  if (!/^\d{3,4}$/.test(cvc)) return 'Revisa el código de seguridad.';
  if (holder.trim().length < 5) return 'Escribe el nombre completo que aparece en la tarjeta.';
  return null;
}
