import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isManagedCustomerStore } from '@/lib/customerDataAccess';

export function useCustomerAddresses(userId?: string, storeId?: string, slug?: string) {
  return useQuery({
    queryKey: ['customer-addresses', userId, storeId],
    enabled: !!userId && !!storeId && !isManagedCustomerStore(slug),
    queryFn: async () => {
      if (!userId || !storeId) return [];
      const { data, error } = await supabase.from('customer_addresses').select('*').eq('user_id', userId).eq('store_id', storeId).order('created_at');
      if (error) throw error;
      return data || [];
    },
  });
}