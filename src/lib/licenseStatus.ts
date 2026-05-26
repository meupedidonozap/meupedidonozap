export const LICENSE_WARN_DAYS = 5;

export type LicenseLevel = 'none' | 'ok' | 'warning' | 'expired';

export interface LicenseStatus {
  level: LicenseLevel;
  daysLeft: number | null;
  expiresAt: Date | null;
  formatted: string;
}

export function getLicenseStatus(licenseExpiresAt?: string | null): LicenseStatus {
  if (!licenseExpiresAt) {
    return { level: 'none', daysLeft: null, expiresAt: null, formatted: 'Sem vencimento' };
  }
  // Parse as local date (YYYY-MM-DD) to avoid TZ shift
  const [y, m, d] = licenseExpiresAt.split('-').map(Number);
  const expires = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = expires.getTime() - today.getTime();
  const daysLeft = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const formatted = expires.toLocaleDateString('pt-BR');
  let level: LicenseLevel = 'ok';
  if (daysLeft < 0) level = 'expired';
  else if (daysLeft <= LICENSE_WARN_DAYS) level = 'warning';
  return { level, daysLeft, expiresAt: expires, formatted };
}
