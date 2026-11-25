import { useStoreAdmin } from './useStoreAdmin';

/** Commercial identity and navigation share the same authorized store access. */
export function useSellerMode(storeId: string | undefined) {
  const access = useStoreAdmin(storeId);
  const isSeller = (access.role === 'vendedor' || access.role === 'televendas') && access.staffSellerCodes.length > 0;
  const isManager = access.role === 'gerente';
  return {
    user: access.user,
    canSell: isSeller || access.isAdmin || isManager,
    isStaff: access.isStoreUser || access.isAdmin,
    canAdmin: access.hasAccess,
    isSeller,
    isAdmin: access.isAdmin || isManager,
    isManager,
    sellerCodes: access.staffSellerCodes,
    sellerName: access.sellerName,
    isTelevendas: access.role === 'televendas',
    erpCode: access.erpCode,
    loading: access.loading,
    accessError: access.accessError,
    retryAccess: access.retryAccess,
  };
}
