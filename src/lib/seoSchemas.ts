import type { Store } from '@/types';

const BASE_URL = 'https://meupedidonozap.lovable.app';

function schemaTypeForStore(type: Store['type']): string {
  switch (type) {
    case 'COMIDA':
    case 'PIZZARIA':
      return 'Restaurant';
    case 'SALAO':
      return 'HealthAndBeautyBusiness';
    case 'SERVICOS':
      return 'LocalBusiness';
    case 'LOJA':
    case 'ACESSORIOS':
    default:
      return 'Store';
  }
}

/**
 * Generates a JSON-LD object for a store, choosing schema.org type
 * by store type and including address/openingHours when available.
 */
export function buildStoreJsonLd(store: Store): Record<string, unknown> {
  const url = `${BASE_URL}/${store.slug}`;
  const wh = store.settings?.workingHours;
  const dayMap: Record<string, string> = {
    monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th',
    friday: 'Fr', saturday: 'Sa', sunday: 'Su',
  };
  const openingHours = wh
    ? Object.entries(wh)
        .filter(([, v]: any) => v?.isOpen)
        .map(([k, v]: any) => `${dayMap[k]} ${v.open}-${v.close}`)
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': schemaTypeForStore(store.type),
    name: store.name,
    url,
    image: store.logo || store.banner || undefined,
    telephone: store.whatsapp || store.phone || undefined,
    email: store.email || undefined,
    address: store.address
      ? { '@type': 'PostalAddress', streetAddress: store.address }
      : undefined,
    openingHours,
    priceRange: '$$',
  };
}