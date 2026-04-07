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
      // Verify there's an active authenticated session before touching the DB
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Você precisa estar autenticado para salvar seu perfil. Faça login e tente novamente.');
      }
      // Use session user_id as source of truth (matches RLS auth.uid())
      const authenticatedUserId = session.user.id;

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

      // Normal upsert (no orphan found)
      const { data, error } = await supabase
        .from('customer_profiles')
        .upsert({
          user_id: profile.userId,
          store_id: profile.storeId,
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
        }, { onConflict: 'user_id,store_id' })
        .select()
        .single();
      if (error) throw error;
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
