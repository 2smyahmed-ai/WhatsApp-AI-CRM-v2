export function formatPhone(phone?: string | null): string {
  if (!phone) return 'Unknown number';

  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return phone;

  if (digits.length <= 4) return digits;

  const intl = `+${digits}`;

  if (digits.length === 10) {
    return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 11) {
    return `+${digits.slice(0, 1)} ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  if (digits.length === 12) {
    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }

  if (digits.length >= 13) {
    return intl.slice(0, 4) + ' ' + intl.slice(4, 8) + ' ' + intl.slice(8);
  }

  return intl;
}
