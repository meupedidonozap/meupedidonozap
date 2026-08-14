import { normalizePriceTable } from '@/lib/pricing';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerProfile {
  id: string;
  userId?: string;
  storeId: string;
  name: string;
  cpfCnpj: string;
  whatsapp: string;
  cep: string;
  uf: string;
  city: string;
  neighborhood: string;
  address: string;
  number: string;
  complement?: string;
  sellerCode?: string;
  transportadora?: string;
  ie?: string;
  /** 1 = atacado, 4 = varejo (default), 9 = atacado. */
  priceTable?: 1 | 4 | 9 | 11;
}

function mapProfile(row: any): CustomerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    name: row.name,
    cpfCnpj: row.cpf_cnpj,
    whatsapp: row.whatsapp,
    cep: row.cep,
    uf: row.uf,
    city: row.city,
    neighborhood: row.neighborhood,
    address: row.address,
    number: row.number,
    complement: row.complement || undefined,
    sellerCode: row.seller_code || '',
    priceTable: normalizePriceTable(row.price_table),
  };
}

export function useCustomerProfile(userId: string | undefined, storeId: string | undefined) {
  return useQuery({
    queryKey: ['customer-profile', userId, storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', userId!)
        .eq('store_id', storeId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapProfile(data) : null;
    },
    enabled: !!userId && !!storeId,
  });
}

export function useUpsertCustomerProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profile: Omit<CustomerProfile, 'id'>) => {
      // Validate session on the server (refreshes token if expired)
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        throw new Error('Sua sessão expirou. Faça login novamente.');
      }
      // Use server-validated user_id as source of truth (matches RLS auth.uid())
      const authenticatedUserId = authUser.id;

      // First check if there's an orphan profile (user_id IS NULL) with matching whatsapp in this store
      // If found, claim it by setting the user_id instead of creating a duplicate
      const cleanWhatsapp = profile.whatsapp.replace(/\D/g, '');
      if (cleanWhatsapp) {
        const { data: orphan } = await supabase
          .from('customer_profiles')
          .select('id')
          .eq('store_id', profile.storeId)
          .is('user_id', null)
          .ilike('whatsapp', `%${cleanWhatsapp.slice(-8)}%`)
          .maybeSingle();
        
        if (orphan) {
          // Claim this orphan profile by updating it with user data
          const { data, error } = await supabase
            .from('customer_profiles')
            .update({
              user_id: authenticatedUserId,
              name: profile.name,
              cpf_cnpj: profile.cpfCnpj,
              whatsapp: profile.whatsapp,
              cep: profile.cep,
              uf: profile.uf,
              city: profile.city,
              neighborhood: profile.neighborhood,
              address: profile.address,
              number: profile.number,
              complement: profile.complement || null,
            })
            .eq('id', orphan.id)
            .select()
            .single();
          if (error) throw error;
          return mapProfile(data);
        }
      }

      // Look for an ERP "twin" profile in this store (same last-8 of phone,
      // already has customer_code). We won't move user_id, but we'll mirror
      // the ERP data into this user's profile so the XML exports get the
      // correct CPF/CNPJ and seller code.
      let erpTwin: any = null;
      if (cleanWhatsapp) {
        const { data: twins } = await supabase
          .from('customer_profiles')
          .select('id, customer_code, seller_code, cpf_cnpj, cep, uf, city, neighborhood, address, number, complement')
          .eq('store_id', profile.storeId)
          .neq('customer_code', '')
          .ilike('whatsapp', `%${cleanWhatsapp.slice(-8)}%`)
          .limit(5);
        erpTwin = (twins || []).find((t: any) => (t.customer_code || '').trim() !== '') || null;
      }

      const prefer = (userVal: string | undefined | null, erpVal: string | undefined | null) => {
        const u = String(userVal ?? '').trim();
        if (u) return u;
        return String(erpVal ?? '').trim();
      };

      // Normal upsert (no orphan found) — backfill from ERP twin when present
      const { data, error } = await supabase
        .from('customer_profiles')
        .upsert({
          user_id: authenticatedUserId,
          store_id: profile.storeId,
          name: profile.name,
          cpf_cnpj: prefer(profile.cpfCnpj, erpTwin?.cpf_cnpj),
          whatsapp: profile.whatsapp,
          cep: prefer(profile.cep, erpTwin?.cep),
          uf: prefer(profile.uf, erpTwin?.uf),
          city: prefer(profile.city, erpTwin?.city),
          neighborhood: prefer(profile.neighborhood, erpTwin?.neighborhood),
          address: prefer(profile.address, erpTwin?.address),
          number: prefer(profile.number, erpTwin?.number),
          complement: prefer(profile.complement, erpTwin?.complement) || null,
        }, { onConflict: 'user_id,store_id' })
        .select()
        .single();
      if (error) throw error;

      // Backfill seller_code from the ERP twin only when this profile has none.
      // We never overwrite a seller_code already set on the user's profile.
      const erpSeller = String(erpTwin?.seller_code || '').trim();
      if (erpSeller && !String(data.seller_code || '').trim()) {
        const { data: updated } = await supabase
          .from('customer_profiles')
          .update({ seller_code: erpSeller })
          .eq('id', data.id)
          .select()
          .single();
        if (updated) return mapProfile(updated);
      }
      return mapProfile(data);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['customer-profile', data.userId, data.storeId] });
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', data.storeId] });
    },
  });
}

export function useCustomerOrders(userId: string | undefined, storeId: string | undefined) {
  return useQuery({
    queryKey: ['customer-orders', userId, storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId!)
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId && !!storeId,
  });
}
