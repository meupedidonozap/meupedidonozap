export interface StoreRules {
  requireReleasePayment: boolean;
  notifyReleaseWhatsapp: boolean;
  manual: string;
}

export function getStoreRules(slug?: string, settings?: any): StoreRules {
  const rules = settings?.rules || {};
  return {
    requireReleasePayment: rules.requireReleasePayment !== false,
    notifyReleaseWhatsapp: rules.notifyReleaseWhatsapp !== false,
    manual: typeof rules.manual === 'string' ? rules.manual : '',
  };
}

export function releasePaymentRequired(slug?: string, settings?: any): boolean {
  return slug !== 'dicolore' || getStoreRules(slug, settings).requireReleasePayment;
}