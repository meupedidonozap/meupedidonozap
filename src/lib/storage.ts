import { supabase } from '@/integrations/supabase/client';

/**
 * Compress an image using Canvas before upload.
 * - Max 800x800px
 * - WebP with 0.8 quality (fallback to JPEG)
 * - Reduces file size by 70-90%
 */
async function compressImage(file: File, maxSize = 800, quality = 0.8): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down if needed
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }

      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fallback to JPEG
      const tryFormat = (mime: string, ext: string) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const name = file.name.replace(/\.[^.]+$/, `.${ext}`);
              resolve(new File([blob], name, { type: mime }));
            } else if (mime === 'image/webp') {
              tryFormat('image/jpeg', 'jpg');
            } else {
              resolve(file);
            }
          },
          mime,
          quality
        );
      };

      tryFormat('image/webp', 'webp');
    };

    img.onerror = () => resolve(file); // fallback to original on error
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadProductImage(file: File, storeId: string): Promise<string> {
  // Compress before uploading
  const compressed = await compressImage(file);

  const ext = compressed.name.split('.').pop();
  const fileName = `${storeId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, compressed, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return data.publicUrl;
}
