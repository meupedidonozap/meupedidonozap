import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useStoreAdmin(storeId: string | undefined) {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ['store-admin', storeId, user?.id],
    queryFn: async () => {
      if (!user || !storeId) return false;
      const { data } = await supabase
        .from('store_admins')
        .select('id')
        .eq('store_id', storeId)
        .eq('user_id', user.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!storeId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    user,
    isAdmin: isAdmin ?? false,
    loading: authLoading || adminLoading,
  };
}
