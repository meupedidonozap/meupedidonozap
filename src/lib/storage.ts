import { supabase } from '@/integrations/supabase/client';

export async function uploadProductImage(file: File, storeId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${storeId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
