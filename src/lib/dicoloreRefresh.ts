import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { isAndroidApp } from '@/lib/nativeAndroid';
import { REPORT_FAMILIES } from '@/lib/dicoloreReportCache';

export const CUSTOMER_DATA = ['store-customer-profiles', 'client-intel-base', 'customer-profile', 'selected-customer-profile', 'my-customer-code'];
// Checkout still checks outstanding debt; report refresh belongs to its confirmation.
export const FINANCIAL_DATA = ['overdue-titles'];
export const ORDER_DATA = ['orders', 'seller-orders', 'customer-orders', 'customer-erp-orders', 'erp-orders', 'erp-order-items'];
export const STOCK_DATA = ['products'];
export const SCREEN_DATA = ['store-access', ...CUSTOMER_DATA, ...FINANCIAL_DATA, ...STOCK_DATA];

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
  // Browser resume refreshes active reports; APK reports remain approval-only.
  const effectiveFamilies = !isAndroidApp() && families === SCREEN_DATA
    ? [...families, ...Object.values(REPORT_FAMILIES).flat()]
    : families;
  await client.invalidateQueries({
    predicate: query => isStoreData(query.queryKey, storeId, effectiveFamilies)
      && (!activeOnly || query.isActive())
      && query.state.fetchStatus !== 'fetching'
      // Entry, panel mount, pageshow and focus can represent the same gesture.
      && (query.state.isInvalidated || Date.now() - query.state.dataUpdatedAt >= 1000),
    refetchType: 'active',
  }, { cancelRefetch: false });
}