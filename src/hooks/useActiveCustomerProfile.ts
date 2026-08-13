import { useAuth } from './useAuth';
import { useCustomerProfile } from './useCustomerProfile';
import { useSellerMode } from './useSellerMode';
import { useSellerContext } from '@/contexts/SellerContext';

/**
 * Perfil de cliente "ativo" da vitrine/checkout:
 * - Modo Vendedor: o cliente selecionado pelo vendedor.
 * - Fluxo normal: o próprio perfil do usuário logado.
 */
export function useActiveCustomerProfile(storeId: string | undefined) {
  const { user } = useAuth();
  const { data: ownProfile } = useCustomerProfile(user?.id, storeId);
  const seller = useSellerMode(storeId);
  const { selectedCustomer, selectCustomer, clearSelectedCustomer } = useSellerContext();

  const sellerActive = seller.canSell;
  const selected = sellerActive && selectedCustomer && selectedCustomer.storeId === storeId
    ? selectedCustomer
    : null;

  return {
    profile: selected ?? ownProfile ?? null,
    isSellerMode: sellerActive,
    selectedCustomer: selected,
    selectCustomer,
    clearSelectedCustomer,
    seller,
  };
}
