import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Coupon } from '@/types';

function mapCoupon(row: any): Coupon {
  return {
    id: row.id,
    storeId: row.store_id,
    code: row.code,
    discountPercent: row.discount_percent ? Number(row.discount_percent) : undefined,
    discountValue: row.discount_value ? Number(row.discount_value) : undefined,
    minOrderValue: Number(row.min_order_value),
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  };
}

export function useCoupons(storeId: string | undefined) {
  return useQuery({
    queryKey: ['coupons', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', storeId!)
        .order('expires_at');
      if (error) throw error;
      return (data || []).map(mapCoupon);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCouponsByStoreSlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['coupons', 'slug', slug],
    queryFn: async () => {
      const { data: store } = await supabase
        .from('stores')
        .select('id')
        .eq('slug', slug!)
        .maybeSingle();
      if (!store) return [];
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map(mapCoupon);
    },
    enabled: !!slug,
  });
}
