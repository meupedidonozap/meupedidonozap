import type { CartItem } from '@/types';

export interface KitComponent {
  productId: string;
  code: string;
  name: string;
  /** Quantidade do componente dentro de 1 kit. */
  quantity: number;
  /** Preço cheio unitário do componente (usado apenas para o rateio). */
  fullPrice: number;
}

/** Mapa: id do produto KIT -> componentes. */
export type KitMap = Record<string, KitComponent[]>;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Junta componentes repetidos dentro do mesmo kit numa única linha. */
function mergeComponents(components: KitComponent[]): KitComponent[] {
  const map = new Map<string, KitComponent>();
  for (const c of components) {
    const qty = Number(c.quantity) || 0;
    if (qty <= 0) continue;
    const found = map.get(c.productId);
    if (found) found.quantity += qty;
    else map.set(c.productId, { ...c, quantity: qty });
  }
  return [...map.values()];
}

/**
 * Rateia o preço unitário do kit entre os componentes, proporcionalmente ao
 * preço cheio de cada um. A sobra de centavos vai para o último componente,
 * de modo que a soma bata exatamente com o valor do kit.
 */
export function rateKitUnitPrices(kitUnitPrice: number, components: KitComponent[]): number[] {
  const target = round2(kitUnitPrice);
  const weights = components.map(c => (Number(c.fullPrice) > 0 ? Number(c.fullPrice) : 0) * c.quantity);
  const sum = weights.reduce((a, b) => a + b, 0);
  const useEqual = !(sum > 0);
  const qtySum = components.reduce((a, c) => a + c.quantity, 0) || 1;

  const unitPrices: number[] = [];
  let accumulated = 0;
  components.forEach((c, i) => {
    if (i === components.length - 1) {
      const remaining = round2(target - accumulated);
      unitPrices.push(round2(remaining / c.quantity));
      return;
    }
    const share = useEqual ? (c.quantity / qtySum) * target : (weights[i] / sum) * target;
    const unit = round2(share / c.quantity);
    accumulated = round2(accumulated + unit * c.quantity);
    unitPrices.push(unit);
  });
  return unitPrices;
}

/**
 * Substitui itens KIT pelos produtos que os compõem, com preço rateado e
 * quantidade multiplicada pela quantidade de kits comprados.
 * Itens sem composição cadastrada passam intactos.
 */
export function expandKitItems(items: CartItem[], kitMap: KitMap | undefined | null): CartItem[] {
  if (!kitMap || !items?.length) return items || [];
  const out: CartItem[] = [];
  for (const item of items) {
    const components = mergeComponents(kitMap[item.productId] || []);
    if (components.length === 0) {
      out.push(item);
      continue;
    }
    const unitPrices = rateKitUnitPrices(Number(item.price) || 0, components);
    components.forEach((c, i) => {
      out.push({
        ...item,
        productId: c.productId,
        variantId: undefined,
        code: c.code,
        name: c.name,
        color: undefined,
        size: undefined,
        price: unitPrices[i],
        quantity: c.quantity * item.quantity,
        image: undefined,
        kitParentCode: item.code,
        kitParentName: item.name,
      } as CartItem);
    });
  }
  return out;
}
