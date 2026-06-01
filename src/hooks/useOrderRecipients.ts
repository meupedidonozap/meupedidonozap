import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderRecipient {
  id: string;
  name: string;
  whatsapp: string;
  kind: 'vendedor' | 'televendas';
}

export function useOrderRecipients(storeId: string | undefined, sellerCode: string | undefined) {
  return useQuery({
    queryKey: ['order-recipients', storeId, sellerCode],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_order_recipients', {
        p_store_id: storeId!,
        p_seller_code: sellerCode!,
      });
      if (error) throw error;
      return ((data ?? []) as OrderRecipient[]);
    },
    enabled: !!storeId && !!sellerCode,
  });
}