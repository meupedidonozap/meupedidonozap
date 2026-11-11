export function recoveryCart(order: { storeId: string; items: unknown[]; subtotal: number; discount: number; total: number }, backup?: string | null) {
  if (backup) {
    try {
      const parsed = JSON.parse(backup);
      if (parsed.storeId === order.storeId && Array.isArray(parsed.items) && parsed.items.length) return parsed;
    } catch { /* use authorized order */ }
  }
  return { storeId: order.storeId, items: order.items, subtotal: order.subtotal, couponDiscount: 0, quantityDiscount: 0, total: order.subtotal };
}