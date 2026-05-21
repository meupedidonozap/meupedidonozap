import type { CartItem, Product, FoodItem } from '@/types';

export const MATERIAL_APOIO_MSG = 'MATERIAL DE APOIO PASSA DA REGRA DE BONIFICAÇÃO';

export interface MaterialApoioConfig {
  enabled: boolean;
  maxPercent: number;
  categoryIds: string[];
}

type AnyProduct = Product | FoodItem | { id: string; categoryId?: string };

function categoryOf(productId: string, products: AnyProduct[] | undefined): string | undefined {
  return products?.find(p => p.id === productId)?.categoryId;
}

/**
 * Calcula o limite máximo permitido em itens das categorias "material de apoio".
 * Regra: total_material <= (subtotal_outras) * percent / 100.
 * Verifica se a adição de `extra` (valor monetário) à categoria de apoio ainda
 * respeita a regra.
 *
 * Se a categoria do produto candidato NÃO é de apoio, sempre permite.
 */
export function wouldExceedMaterialApoio(
  currentItems: CartItem[],
  candidateProductId: string,
  candidateAdditionalValue: number,
  products: AnyProduct[] | undefined,
  config: MaterialApoioConfig | undefined,
): { exceeds: boolean; limit: number; currentMaterial: number } {
  if (!config || !config.enabled || !config.maxPercent || !config.categoryIds?.length) {
    return { exceeds: false, limit: Infinity, currentMaterial: 0 };
  }
  const apoioSet = new Set(config.categoryIds);
  const candidateCat = categoryOf(candidateProductId, products);
  // se candidato NÃO é apoio, nunca bloqueia
  if (!candidateCat || !apoioSet.has(candidateCat)) {
    return { exceeds: false, limit: Infinity, currentMaterial: 0 };
  }

  let outras = 0;
  let material = 0;
  for (const it of currentItems) {
    const cat = categoryOf(it.productId, products);
    const v = it.price * it.quantity;
    if (cat && apoioSet.has(cat)) material += v;
    else outras += v;
  }
  const limit = outras * (config.maxPercent / 100);
  const newMaterial = material + candidateAdditionalValue;
  return { exceeds: newMaterial > limit + 0.001, limit, currentMaterial: newMaterial };
}