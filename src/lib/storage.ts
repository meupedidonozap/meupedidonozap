import { supabase } from '@/integrations/supabase/client';

/**
 * Compress an image using Canvas before upload.
 * - Max 800x800px
 * - WebP with 0.8 quality (fallback to JPEG)
 * - Reduces file size by 70-90%
 */
export async function compressImage(file: File, maxSize = 800, quality = 0.8): Promise<File> {
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

/**
 * Extract the storage path from a full public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/product-images/storeId/123.jpg"
 * → "storeId/123.jpg"
 */
function extractStoragePath(publicUrl: string): string | null {
  const marker = '/product-images/';
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}

/**
 * Recompress a single existing image in storage.
 * Downloads it, compresses via Canvas, re-uploads with upsert.
 * Returns true if optimized, false if skipped.
 */
export async function recompressExistingImage(imageUrl: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;

    const blob = await response.blob();

    // Skip small images (already optimized)
    if (blob.size < 100_000) return false;

    const originalFile = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
    const compressed = await compressImage(originalFile);

    // If compression didn't help much, skip
    if (compressed.size >= blob.size * 0.9) return false;

    const storagePath = extractStoragePath(imageUrl);
    if (!storagePath) return false;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(storagePath, compressed, { upsert: true });

    if (error) {
      console.error('Erro ao reenviar imagem:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Erro ao recomprimir imagem:', err);
    return false;
  }
}
