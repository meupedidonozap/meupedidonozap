export const normalizeInvoiceSeller = (code: unknown): string =>
  String(code ?? '').trim().replace(/^0+(?=\d)/, '');

/** undefined is unrestricted (admin/customer); [] is a seller without linked codes. */
export function matchesInvoiceSeller(code: unknown, allowedCodes?: readonly string[]): boolean {
  if (allowedCodes === undefined) return true;
  const normalized = normalizeInvoiceSeller(code);
  return normalized !== '' && allowedCodes.some((allowed) => normalizeInvoiceSeller(allowed) === normalized);
}