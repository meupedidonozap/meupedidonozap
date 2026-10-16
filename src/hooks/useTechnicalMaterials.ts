import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MaterialMediaType = 'video' | 'pdf' | 'image' | 'link';
export interface MaterialMedia { type: MaterialMediaType; url: string; label?: string }
export interface TechnicalMaterial {
  id: string;
  storeId: string;
  title: string;
  body: string;
  media: MaterialMedia[];
  productIds: string[];
  isActive: boolean;
  sortOrder: number;
}

export const DEFAULT_MATERIAL_LABEL = 'Material Técnico';
export const materialLabel = (settings: any) =>
  (settings?.technicalMaterialLabel as string)?.trim() || DEFAULT_MATERIAL_LABEL;

const map = (r: any): TechnicalMaterial => ({
  id: r.id, storeId: r.store_id, title: r.title, body: r.body || '',
  media: Array.isArray(r.media) ? r.media : [], productIds: r.product_ids || [],
  isActive: r.is_active, sortOrder: r.sort_order,
});

export function useTechnicalMaterials(storeId?: string) {
  return useQuery({
    queryKey: ['technical-materials', storeId],
    enabled: !!storeId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('technical_materials').select('*')
        .eq('store_id', storeId!).order('sort_order').order('title');
      if (error) throw error;
      return (data || []).map(map);
    },
  });
}

export function useSaveTechnicalMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: Partial<TechnicalMaterial> & { storeId: string; title: string }) => {
      const row: any = {
        store_id: m.storeId, title: m.title, body: m.body ?? '', media: m.media ?? [],
        product_ids: m.productIds ?? [], is_active: m.isActive ?? true, sort_order: m.sortOrder ?? 0,
      };
      const q = m.id
        ? supabase.from('technical_materials').update(row).eq('id', m.id).select().single()
        : supabase.from('technical_materials').insert(row).select().single();
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['technical-materials'] }),
  });
}

export function useDeleteTechnicalMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('technical_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['technical-materials'] }),
  });
}

/** Converts YouTube / Instagram links to embeddable URLs; null when not embeddable. */
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    if (host === 'youtu.be') return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(shorts|embed|live)\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[2]}`;
    }
    if (host.endsWith('instagram.com')) {
      const m = u.pathname.match(/\/(p|reel|reels|tv)\/([^/?]+)/);
      if (m) return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`;
    }
  } catch { /* ignore */ }
  return null;
}
