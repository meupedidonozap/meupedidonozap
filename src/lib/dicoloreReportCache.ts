import type { QueryKey } from '@tanstack/react-query';

export type DicoloreReport = 'pedidos' | 'notas' | 'titulos' | 'resultados';

export const REPORT_FAMILIES: Record<DicoloreReport, readonly string[]> = {
  pedidos: ['orders', 'seller-orders', 'customer-orders', 'customer-erp-orders', 'erp-orders', 'erp-order-items', 'erp-orders-clients'],
  notas: ['customer-invoices-v2', 'invoice-items-v2', 'invoice-customer-names'],
  titulos: ['customer-titles', 'titles-customer-names'],
  resultados: ['results-drill', 'results-products', 'results-sellers'],
};

export function reportForKey(key: QueryKey): DicoloreReport | undefined {
  return (Object.keys(REPORT_FAMILIES) as DicoloreReport[]).find(report => REPORT_FAMILIES[report].includes(String(key[0])));
}

export function scopedReportKey(key: QueryKey, scope: string): QueryKey {
  return [...key, 'dicolore-local-v1', scope];
}

export function isScopedReportKey(key: QueryKey, scope: string) {
  return key[key.length - 2] === 'dicolore-local-v1' && key[key.length - 1] === scope;
}

export function reportFromPath(pathname: string): DicoloreReport | undefined {
  if (!pathname.startsWith('/dicolore/')) return undefined;
  const section = pathname.split('/').filter(Boolean).pop();
  if (section === 'vendas' || section === 'pedidos' || pathname === '/dicolore/vendedor') return 'pedidos';
  if (section === 'notas' || section === 'notas-fiscais') return 'notas';
  if (section === 'titulos' || section === 'resultados') return section;
}

export const LOCAL_REPORT_OPTIONS = {
  staleTime: Infinity,
  gcTime: 7 * 24 * 60 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchInterval: false as const,
  retry: false,
};