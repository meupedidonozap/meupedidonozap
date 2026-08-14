import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductVariant, ProductImage } from '@/types';

function mapVariant(row: any): ProductVariant {
  return {
    id: row.id,
    color: row.color || undefined,
    size: row.size || undefined,
    price: Number(row.price),
    stock: row.stock,
    sku: row.sku,
    priceTable1: row.price_table_1 != null ? Number(row.price_table_1) : undefined,
    priceTable4: row.price_table_4 != null ? Number(row.price_table_4) : undefined,
    priceTable9: row.price_table_9 != null ? Number(row.price_table_9) : undefined,
    priceTable11: row.price_table_11 != null ? Number(row.price_table_11) : undefined,
  };
}

function mapImage(row: any): ProductImage {
  return {
    id: row.id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    label: row.label || undefined,
  };
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    storeId: row.store_id,
    code: row.code || '',
    name: row.name,
    description: row.description || '',
    categoryId: row.category_id || '',
    groupId: row.group_id || undefined,
    basePrice: Number(row.base_price),
    stock: row.stock != null ? Number(row.stock) : 0,
    priceTable1: row.price_table_1 != null ? Number(row.price_table_1) : undefined,
    priceTable4: row.price_table_4 != null ? Number(row.price_table_4) : undefined,
    priceTable9: row.price_table_9 != null ? Number(row.price_table_9) : undefined,
    priceTable11: row.price_table_11 != null ? Number(row.price_table_11) : undefined,
    image: row.image_url || undefined,
    isActive: row.is_active,
    hasVariants: row.has_variants,
    isKit: !!row.is_kit,
    unit: row.unit || 'Un',
    variants: row.product_variants?.map(mapVariant) || [],
    images: row.product_images?.map(mapImage) || [],
    durationMinutes: row.duration_minutes ?? 30,
    professionalIds: row.salon_service_professionals?.map((l: any) => l.professional_id) || [],
  };
}

export function useProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*), product_images(*), salon_service_professionals(professional_id)')
        .eq('store_id', storeId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapProduct);
    },
    enabled: !!storeId,
    staleTime: 30_000,
  });
}

async function getNextProductCode(storeId: string): Promise<string> {
  const { data } = await supabase
    .from('products')
    .select('code')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false });

  const codes = (data || []).map(r => r.code).filter(Boolean);
  for (const code of codes) {
    const match = code.match(/^([A-Za-z]*)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const next = (parseInt(numStr, 10) + 1).toString().padStart(numStr.length, '0');
      return prefix + next;
    }
  }
  return '1';
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: {
      storeId: string;
      code: string;
      name: string;
      description: string;
      categoryId: string | null;
      groupId?: string;
      basePrice: number;
      priceTable1?: number;
      priceTable4?: number;
      priceTable9?: number;
      priceTable11?: number;
      stock?: number;
      unit?: string;
      imageUrl?: string;
      isActive: boolean;
      hasVariants: boolean;
      variants?: Omit<ProductVariant, 'id'>[];
      images?: { imageUrl: string; label?: string }[];
      durationMinutes?: number;
      professionalIds?: string[];
    }) => {
      const finalCode = product.code?.trim()
        ? product.code
        : await getNextProductCode(product.storeId);

      const { data, error } = await supabase.from('products').insert({
        store_id: product.storeId,
        code: finalCode,
        name: product.name,
        description: product.description,
        category_id: product.categoryId,
        group_id: product.groupId || null,
        base_price: product.basePrice,
        price_table_1: product.priceTable1 ?? product.basePrice,
        price_table_4: product.priceTable4 ?? product.basePrice,
        price_table_9: product.priceTable9 ?? product.basePrice,
        price_table_11: product.priceTable11 ?? product.basePrice,
        stock: product.stock ?? 0,
        unit: product.unit || 'Un',
        image_url: product.imageUrl || null,
        is_active: product.isActive,
        has_variants: product.hasVariants,
        duration_minutes: product.durationMinutes ?? 30,
      }).select().single();
      if (error) throw error;

      if (product.hasVariants && product.variants?.length) {
        const { error: vError } = await supabase.from('product_variants').insert(
          product.variants.map(v => ({
            product_id: data.id,
            color: v.color || null,
            size: v.size || null,
            price: v.price,
            price_table_1: v.priceTable1 ?? v.price,
            price_table_4: v.priceTable4 ?? v.price,
            price_table_9: v.priceTable9 ?? v.price,
            price_table_11: (v as any).priceTable11 ?? v.price,
            stock: v.stock,
            sku: v.sku,
          }))
        );
        if (vError) throw vError;
      }

      // Save product images if provided
      if (product.images?.length) {
        const { error: iError } = await supabase.from('product_images').insert(
          product.images.map((img, idx) => ({
            product_id: data.id,
            image_url: img.imageUrl,
            sort_order: idx,
            label: img.label || null,
          }))
        );
        if (iError) throw iError;
      }

      // Salon: link professionals via salon_service_professionals (using product.id as service_id)
      if (product.professionalIds && product.professionalIds.length > 0) {
        const rows = product.professionalIds.map(pid => ({ service_id: data.id, professional_id: pid }));
        await supabase.from('salon_service_professionals').insert(rows);
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: {
      id: string;
      code?: string;
      name?: string;
      description?: string;
      categoryId?: string | null;
      groupId?: string | null;
      basePrice?: number;
      priceTable1?: number;
      priceTable4?: number;
      priceTable9?: number;
      priceTable11?: number;
      stock?: number;
      unit?: string;
      imageUrl?: string | null;
      isActive?: boolean;
      hasVariants?: boolean;
      variants?: Omit<ProductVariant, 'id'>[];
      images?: { imageUrl: string; label?: string }[];
      durationMinutes?: number;
      professionalIds?: string[];
    }) => {
      const updates: any = {};
      if (product.code !== undefined) updates.code = product.code;
      if (product.name !== undefined) updates.name = product.name;
      if (product.description !== undefined) updates.description = product.description;
      if (product.categoryId !== undefined) updates.category_id = product.categoryId;
      if (product.groupId !== undefined) updates.group_id = product.groupId;
      if (product.basePrice !== undefined) updates.base_price = product.basePrice;
      if (product.priceTable1 !== undefined) updates.price_table_1 = product.priceTable1;
      if (product.priceTable4 !== undefined) updates.price_table_4 = product.priceTable4;
      if (product.priceTable9 !== undefined) updates.price_table_9 = product.priceTable9;
      if (product.priceTable11 !== undefined) updates.price_table_11 = product.priceTable11;
      if (product.stock !== undefined) updates.stock = product.stock;
      if (product.unit !== undefined) updates.unit = product.unit || 'Un';
      if (product.imageUrl !== undefined) updates.image_url = product.imageUrl;
      if (product.isActive !== undefined) updates.is_active = product.isActive;
      if (product.hasVariants !== undefined) updates.has_variants = product.hasVariants;
      if (product.durationMinutes !== undefined) updates.duration_minutes = product.durationMinutes;

      const { data: updatedProduct, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', product.id)
        .select('id, image_url')
        .single();
      if (error) throw error;
      if (!updatedProduct) {
        throw new Error('Produto não foi atualizado. Verifique se o login de administrador ainda está ativo.');
      }
      if (product.imageUrl !== undefined && updatedProduct.image_url !== product.imageUrl) {
        throw new Error('A imagem foi enviada, mas não ficou vinculada ao produto. Faça login novamente e tente salvar.');
      }

      // Replace variants if provided
      if (product.variants !== undefined) {
        await supabase.from('product_variants').delete().eq('product_id', product.id);
        if (product.variants.length > 0) {
          const { error: vError } = await supabase.from('product_variants').insert(
            product.variants.map(v => ({
              product_id: product.id,
              color: v.color || null,
              size: v.size || null,
              price: v.price,
              price_table_1: v.priceTable1 ?? v.price,
              price_table_4: v.priceTable4 ?? v.price,
              price_table_9: v.priceTable9 ?? v.price,
              price_table_11: (v as any).priceTable11 ?? v.price,
            price_table_11: (v as any).priceTable11 ?? v.price,
              stock: v.stock,
              sku: v.sku,
            }))
          );
          if (vError) throw vError;
        }
      }

      // Replace images if provided
      if (product.images !== undefined) {
        await supabase.from('product_images').delete().eq('product_id', product.id);
        if (product.images.length > 0) {
          const { error: iError } = await supabase.from('product_images').insert(
            product.images.map((img, idx) => ({
              product_id: product.id,
              image_url: img.imageUrl,
              sort_order: idx,
              label: img.label || null,
            }))
          );
          if (iError) throw iError;
        }
      }

      // Salon: replace professional links
      if (product.professionalIds !== undefined) {
        await supabase.from('salon_service_professionals').delete().eq('service_id', product.id);
        if (product.professionalIds.length > 0) {
          const rows = product.professionalIds.map(pid => ({ service_id: product.id, professional_id: pid }));
          await supabase.from('salon_service_professionals').insert(rows);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
