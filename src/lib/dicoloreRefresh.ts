import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const CUSTOMER_DATA = ['store-customer-profiles', 'customer-profile', 'selected-customer-profile', 'my-customer-code', 'titles-customer-names', 'invoice-customer-names', 'erp-orders-clients'];
export const FINANCIAL_DATA = ['customer-titles', 'overdue-titles', 'customer-invoices-v2', 'invoice-items-v2'];
export const ORDER_DATA = ['orders', 'seller-orders', 'customer-orders', 'customer-erp-orders', 'erp-orders', 'erp-order-items'];
export const STOCK_DATA = ['products'];
export const SCREEN_DATA = [...CUSTOMER_DATA, ...FINANCIAL_DATA, ...ORDER_DATA, ...STOCK_DATA];

// Legacy own-customer keys put the user before the store. Never match arbitrary
// values in the key: customer/seller ids must not be mistaken for a store id.
export function isStoreData(key: QueryKey, storeId: string, families: readonly string[]) {
  const family = String(key[0]);
  const storeIndex = ['customer-profile', 'customer-orders', 'my-customer-code'].includes(family) ? 2 : 1;
  return families.includes(family) && key[storeIndex] === storeId;
}

export async function refreshDicoloreData(
  client: QueryClient, slug: string | undefined, storeId: string | undefined,
  families: readonly string[], activeOnly = true,
) {
  if (slug !== 'dicolore' || !storeId || !navigator.onLine || document.visibilityState === 'hidden') return;
  await client.invalidateQueries({
    predicate: query => isStoreData(query.queryKey, storeId, families)
      && (!activeOnly || query.isActive())
      && query.state.fetchStatus !== 'fetching'
      // Entry, panel mount, pageshow and focus can represent the same gesture.
      && (query.state.isInvalidated || Date.now() - query.state.dataUpdatedAt >= 1000),
    refetchType: 'active',
  }, { cancelRefetch: false });
}