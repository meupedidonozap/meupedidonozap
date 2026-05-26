import type { Store } from '@/types';
import { getLicenseStatus } from './licenseStatus';

export const SUPPORT_WHATSAPP = '5547999625155';

export function buildRenewalLink(store: Pick<Store, 'name' | 'slug' | 'licenseExpiresAt'>): string {
  const status = getLicenseStatus(store.licenseExpiresAt);
  const venc = status.expiresAt ? ` Vencimento: ${status.formatted}.` : '';
  const msg = `Olá, quero renovar minha licença da loja "${store.name}" (/${store.slug}).${venc}`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
