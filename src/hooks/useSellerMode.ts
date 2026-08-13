import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useStoreAdmin } from './useStoreAdmin';

/**
 * Detecta se o usuário logado pode emitir pedidos em nome de um cliente
 * pela vitrine (Modo Vendedor). Vale para store_users com papel
 * vendedor/televendas e também para administradores da loja.
 */
export function useSellerMode(storeId: string | undefined) {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useStoreAdmin(storeId);

  const { data, isLoading } = useQuery({
    queryKey: ['seller-mode', storeId, user?.id],
    queryFn: async () => {
      const { data: row } = await supabase
        .from('store_users')
        .select('name, role, seller_codes, is_active')
        .eq('store_id', storeId!)
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!row) return { isSeller: false, sellerCodes: [] as string[], sellerName: '' };
      const role = String((row as any).role || 'auxiliar');
      const codes = (((row as any).seller_codes ?? []) as string[]).map(c => String(c).trim()).filter(Boolean);
      return {
        isSeller: (role === 'vendedor' || role === 'televendas') && codes.length > 0,
        sellerCodes: codes,
        sellerName: (row as any).name || '',
      };
    },
    enabled: !!user && !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  const isSeller = !!data?.isSeller;
  return {
    /** Pode escolher o cliente na vitrine */
    canSell: isSeller || isAdmin,
    isSeller,
    isAdmin,
    sellerCodes: data?.sellerCodes ?? [],
    sellerName: data?.sellerName ?? '',
    loading: adminLoading || (!!user && !!storeId && isLoading),
  };
}
