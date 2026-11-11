import type { Store } from '@/types';
import { getLicenseStatus } from './licenseStatus';

export const SUPPORT_WHATSAPP = '5547999625155';

/**
 * Contato de atendimento comercial do Catálogo Digital, por loja.
 * Lojas fora desta lista não exibem o botão de atendimento.
 */
export const DICOLORE_ATTENDANCE_WHATSAPP = '554791865816';
export const DICOLORE_ATTENDANCE_MESSAGE =
  'Olá, gostaria de comprar produtos pelo Catálogo Digital da Dicolore, como eu faço?';

const ATTENDANCE: Record<string, { whatsapp: string; message: string }> = {
  dicolore: { whatsapp: DICOLORE_ATTENDANCE_WHATSAPP, message: DICOLORE_ATTENDANCE_MESSAGE },
};

/** Link de WhatsApp do atendimento comercial; null quando a loja não tem atendimento configurado. */
export function buildAttendanceLink(slug?: string): string | null {
  const cfg = ATTENDANCE[String(slug || '').trim().toLowerCase()];
  if (!cfg) return null;
  return `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(cfg.message)}`;
}

export function buildRenewalLink(store: Pick<Store, 'name' | 'slug' | 'licenseExpiresAt'>): string {
  const status = getLicenseStatus(store.licenseExpiresAt);
  const venc = status.expiresAt ? ` Vencimento: ${status.formatted}.` : '';
  const msg = `Olá, quero renovar minha licença da loja "${store.name}" (/${store.slug}).${venc}`;
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;
}
