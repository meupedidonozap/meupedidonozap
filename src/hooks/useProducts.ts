import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Product, ProductVariant } from '@/types';

function mapVariant(row: any): ProductVariant {
  return {
    id: row.id,
    color: row.color || undefined,
    size: row.size || undefined,
    price: Number(row.price),
    stock: row.stock,
    sku: row.sku,
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
    image: row.image_url || undefined,
    isActive: row.is_active,
    hasVariants: row.has_variants,
    variants: row.product_variants?.map(mapVariant) || [],
  };
}

export function useProducts(storeId: string | undefined) {
  return useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapProduct);
    },
    enabled: !!storeId,
  });
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
      imageUrl?: string;
      isActive: boolean;
      hasVariants: boolean;
      variants?: Omit<ProductVariant, 'id'>[];
    }) => {
      const { data, error } = await supabase.from('products').insert({
        store_id: product.storeId,
        code: product.code,
        name: product.name,
        description: product.description,
        category_id: product.categoryId,
        group_id: product.groupId || null,
        base_price: product.basePrice,
        image_url: product.imageUrl || null,
        is_active: product.isActive,
        has_variants: product.hasVariants,
      }).select().single();
      if (error) throw error;

      if (product.hasVariants && product.variants?.length) {
        const { error: vError } = await supabase.from('product_variants').insert(
          product.variants.map(v => ({
            product_id: data.id,
            color: v.color || null,
            size: v.size || null,
            price: v.price,
            stock: v.stock,
            sku: v.sku,
          }))
        );
        if (vError) throw vError;
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
      imageUrl?: string | null;
      isActive?: boolean;
      hasVariants?: boolean;
      variants?: Omit<ProductVariant, 'id'>[];
    }) => {
      const updates: any = {};
      if (product.code !== undefined) updates.code = product.code;
      if (product.name !== undefined) updates.name = product.name;
      if (product.description !== undefined) updates.description = product.description;
      if (product.categoryId !== undefined) updates.category_id = product.categoryId;
      if (product.groupId !== undefined) updates.group_id = product.groupId;
      if (product.basePrice !== undefined) updates.base_price = product.basePrice;
      if (product.imageUrl !== undefined) updates.image_url = product.imageUrl;
      if (product.isActive !== undefined) updates.is_active = product.isActive;
      if (product.hasVariants !== undefined) updates.has_variants = product.hasVariants;

      const { error } = await supabase.from('products').update(updates).eq('id', product.id);
      if (error) throw error;

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
              stock: v.stock,
              sku: v.sku,
            }))
          );
          if (vError) throw vError;
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
