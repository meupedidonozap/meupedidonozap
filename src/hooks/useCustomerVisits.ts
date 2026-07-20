import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerVisit {
  id: string;
  store_id: string;
  seller_user_id: string;
  seller_code: string | null;
  customer_profile_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  distance_meters_at_checkin: number | null;
}

export function useCustomerVisits(storeId: string | undefined, opts?: { onlyMine?: boolean; sinceIso?: string }) {
  return useQuery({
    queryKey: ['customer-visits', storeId, opts?.onlyMine, opts?.sinceIso],
    queryFn: async () => {
      let q = supabase
        .from('customer_visits')
        .select('*')
        .eq('store_id', storeId!)
        .order('checked_in_at', { ascending: false });
      if (opts?.sinceIso) q = q.gte('checked_in_at', opts.sinceIso);
      if (opts?.onlyMine) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) q = q.eq('seller_user_id', user.id);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CustomerVisit[];
    },
    enabled: !!storeId,
  });
}

export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      storeId: string;
      customerProfileId: string;
      sellerCode: string | null;
      lat: number;
      lng: number;
      distanceMeters: number;
    }) => {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error('Sessão expirada. Faça login novamente.');
      const { data, error } = await supabase
        .from('customer_visits')
        .insert({
          store_id: input.storeId,
          seller_user_id: user.id,
          seller_code: input.sellerCode,
          customer_profile_id: input.customerProfileId,
          checked_in_at: new Date().toISOString(),
          checkin_lat: input.lat,
          checkin_lng: input.lng,
          distance_meters_at_checkin: Math.round(input.distanceMeters),
        })
        .select()
        .single();
      if (error) throw error;
      return data as CustomerVisit;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['customer-visits', v.store_id] });
    },
  });
}

export function useCheckOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { visitId: string; lat: number; lng: number }) => {
      const { data, error } = await supabase
        .from('customer_visits')
        .update({
          checked_out_at: new Date().toISOString(),
          checkout_lat: input.lat,
          checkout_lng: input.lng,
        })
        .eq('id', input.visitId)
        .select()
        .single();
      if (error) throw error;
      return data as CustomerVisit;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ['customer-visits', v.store_id] });
    },
  });
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const { data, error } = await supabase.functions.invoke('geocode-address', { body: { address } });
  if (error) return null;
  if (data && typeof data.lat === 'number' && typeof data.lng === 'number') {
    return { lat: data.lat, lng: data.lng };
  }
  return null;
}

export async function saveCustomerGeo(customerProfileId: string, lat: number, lng: number) {
  await supabase.from('customer_profiles').update({ geo_lat: lat, geo_lng: lng }).eq('id', customerProfileId);
}