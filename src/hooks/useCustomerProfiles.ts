import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerProfile } from './useCustomerProfile';

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

export function useStoreCustomerProfiles(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-customer-profiles', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('store_id', storeId!)
        .order('name');
      if (error) throw error;
      return (data || []).map(mapProfile);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateCustomerProfileAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      storeId: string;
      name: string;
      whatsapp?: string;
      cep?: string;
      uf?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      number?: string;
      complement?: string;
    }) => {
      const { error } = await supabase
        .from('customer_profiles')
        .insert({
          store_id: params.storeId,
          name: params.name,
          whatsapp: params.whatsapp || '',
          cep: params.cep || '',
          uf: params.uf || '',
          city: params.city || '',
          neighborhood: params.neighborhood || '',
          address: params.address || '',
          number: params.number || '',
          complement: params.complement || null,
        });
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}

export function useUpdateCustomerProfileAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      storeId: string;
      name?: string;
      whatsapp?: string;
      cep?: string;
      uf?: string;
      city?: string;
      neighborhood?: string;
      address?: string;
      number?: string;
      complement?: string;
    }) => {
      const update: any = {};
      if (params.name !== undefined) update.name = params.name;
      if (params.whatsapp !== undefined) update.whatsapp = params.whatsapp;
      if (params.cep !== undefined) update.cep = params.cep;
      if (params.uf !== undefined) update.uf = params.uf;
      if (params.city !== undefined) update.city = params.city;
      if (params.neighborhood !== undefined) update.neighborhood = params.neighborhood;
      if (params.address !== undefined) update.address = params.address;
      if (params.number !== undefined) update.number = params.number;
      if (params.complement !== undefined) update.complement = params.complement;

      const { error } = await supabase
        .from('customer_profiles')
        .update(update)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: (_, params) => {
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', params.storeId] });
    },
  });
}
