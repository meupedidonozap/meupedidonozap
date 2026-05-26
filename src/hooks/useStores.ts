import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Store, StoreSettings } from '@/types';

// Map DB row to app type
function mapStore(row: any): Store {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    logo: row.logo || '',
    banner: row.banner || '',
    address: row.address || '',
    phone: row.phone || '',
    whatsapp: row.whatsapp || '',
    email: row.email || '',
    isActive: row.is_active,
    createdAt: row.created_at,
    settings: (row.settings || {}) as StoreSettings,
    licenseExpiresAt: row.license_expires_at ?? null,
  };
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapStore);
    },
    staleTime: 30_000,
  });
}

export function useStoreBySlug(slug: string) {
  return useQuery({
    queryKey: ['stores', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data ? mapStore(data) : null;
    },
    enabled: !!slug,
    staleTime: 30_000,
  });
}

export function useCreateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (store: Omit<Store, 'id' | 'createdAt'>) => {
      const { data, error } = await supabase.from('stores').insert({
        slug: store.slug,
        name: store.name,
        type: store.type,
        logo: store.logo || '',
        banner: store.banner || '',
        address: store.address,
        phone: store.phone,
        whatsapp: store.whatsapp,
        email: store.email,
        is_active: store.isActive,
        settings: store.settings as any,
      }).select().single();
      if (error) throw error;
      return mapStore(data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Store> & { id: string }) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.whatsapp !== undefined) dbUpdates.whatsapp = updates.whatsapp;
      if (updates.email !== undefined) dbUpdates.email = updates.email;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.settings !== undefined) dbUpdates.settings = updates.settings as any;
      if (updates.logo !== undefined) dbUpdates.logo = updates.logo;
      if (updates.banner !== undefined) dbUpdates.banner = updates.banner;
      if (updates.licenseExpiresAt !== undefined) dbUpdates.license_expires_at = updates.licenseExpiresAt || null;

      const { data, error } = await supabase.from('stores').update(dbUpdates).eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Não foi possível atualizar a loja. Verifique suas permissões.');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}

export function useDeleteStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stores').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stores'] }),
  });
}
