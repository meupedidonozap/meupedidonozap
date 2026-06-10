import type { Store } from '@/types';

const BASE_URL = 'https://meupedidonozap.online';

/**
 * Mapeia o tipo de loja para o @type Schema.org mais específico possível.
 * Tipos específicos ganham rich snippets melhores no Google.
 */
function schemaTypeForStore(type: Store['type']): string {
  switch (type) {
    case 'COMIDA':    return 'Restaurant';
    case 'PIZZARIA':  return 'Restaurant';   // subtipo via servesCuisine
    case 'SALAO':     return 'HairSalon';
    case 'SERVICOS':  return 'LocalBusiness';
    case 'LOJA':      return 'Store';
    case 'ACESSORIOS': return 'ClothingStore';
    default:          return 'Store';
  }
}

/**
 * Retorna descrição automatica por tipo quando a loja não tem descrição própria.
 */
function defaultDescription(store: Store): string {
  const name = store.name;
  switch (store.type) {
    case 'COMIDA':    return `Faça seu pedido de delivery em ${name}. Peça online e receba via WhatsApp.`;
    case 'PIZZARIA':  return `Peça sua pizza em ${name}. Delivery rápido com pedido via WhatsApp.`;
    case 'SALAO':     return `Agende seu horário em ${name}. Serviços de beleza com agendamento online.`;
    case 'SERVICOS':  return `Solicite serviços em ${name} pelo WhatsApp. Atendimento rápido e prático.`;
    default:          return `Compre em ${name} pelo WhatsApp. Catálogo digital com pedido online.`;
  }
}

/**
 * Gera JSON-LD LocalBusiness completo para uma loja.
 * Inclui openingHours, telephone, address e servesCuisine quando disponíveis.
 */
export function buildStoreJsonLd(store: Store): Record<string, unknown> {
  const url = `${BASE_URL}/${store.slug}`;
  const image = store.logo || store.banner || undefined;

  // Horários de funcionamento no formato Schema.org ("Mo 09:00-18:00")
  const wh = store.settings?.workingHours;
  const dayMap: Record<string, string> = {
    monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th',
    friday: 'Fr', saturday: 'Sa', sunday: 'Su',
  };
  const openingHours = wh
    ? Object.entries(wh)
        .filter(([, v]: any) => v?.isOpen)
        .map(([k, v]: any) => `${dayMap[k] ?? k} ${v.open}-${v.close}`)
    : undefined;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaTypeForStore(store.type),
    name: store.name,
    url,
    description: defaultDescription(store),
    ...(image && { image }),
    ...(store.whatsapp && { telephone: store.whatsapp }),
    ...(store.phone && !store.whatsapp && { telephone: store.phone }),
    ...(store.email && { email: store.email }),
    ...(store.address && {
      address: {
        '@type': 'PostalAddress',
        streetAddress: store.address,
        addressCountry: 'BR',
      },
    }),
    ...(openingHours && openingHours.length > 0 && { openingHours }),
    priceRange: '$$',
    // Menu online — importante para restaurantes aparecerem no Google Maps
    ...(store.type === 'COMIDA' || store.type === 'PIZZARIA'
      ? {
          hasMenu: url,
          servesCuisine: store.type === 'PIZZARIA' ? 'Pizza' : 'Brasileira',
          acceptsReservations: false,
        }
      : {}),
    // Potencial action — o Google entende que dá pra pedir direto
    potentialAction: {
      '@type': 'OrderAction',
      target: url,
    },
  };

  return schema;
}

/**
 * JSON-LD BreadcrumbList para navegação.
 * Ex: Home > Pastelaria RM
 */
export function buildBreadcrumbJsonLd(store: Store): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'MeuPedidoNoZap',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: store.name,
        item: `${BASE_URL}/${store.slug}`,
      },
    ],
  };
}

/**
 * JSON-LD WebSite com SearchAction para a home.
 */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MeuPedidoNoZap',
    url: BASE_URL,
    description: 'Cardápio digital e pedidos por WhatsApp sem comissão. Delivery, pizzarias, salões e lojas.',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}
