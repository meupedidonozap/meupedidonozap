import { useAuth } from './useAuth';
import { useCustomerProfile } from './useCustomerProfile';
import { useSellerMode } from './useSellerMode';
import { useSellerContext } from '@/contexts/SellerContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapProfile } from './useCustomerProfile';

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
  const { data: freshSelected } = useQuery({
    queryKey: ['selected-customer-profile', storeId, selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return null;
      const { data, error } = await supabase.from('customer_profiles').select('*').eq('id', selected.id).eq('store_id', selected.storeId).single();
      if (error) throw error;
      return mapProfile(data);
    },
    staleTime: 0,
  });

  return {
    profile: (selected ? freshSelected ?? selected : ownProfile) ?? null,
    isSellerMode: sellerActive,
    selectedCustomer: selected,
    selectCustomer,
    clearSelectedCustomer,
    seller,
  };
}
