/**
 * Masks sensitive data like IC numbers for non-admin users.
 * Shows only last 4 characters, e.g., "950101-01-1234" → "****-**-1234"
 */
export function maskIcNumber(icNumber: string | null, isAdmin: boolean): string {
  if (!icNumber) return '-';
  if (isAdmin) return icNumber;

  // Show only last 4 characters
  const lastFour = icNumber.slice(-4);
  const maskedLength = icNumber.length - 4;
  if (maskedLength <= 0) return icNumber;

  // Replace all non-dash characters before last 4 with asterisks
  const prefix = icNumber.slice(0, maskedLength).replace(/[^\-]/g, '*');
  return prefix + lastFour;
}
