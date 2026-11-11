// Chave de idempotência do carrinho: o mesmo carrinho (mesmo cliente + mesmos
// itens) gera sempre a mesma chave, então reenviá-lo não cria outro pedido.
export function cartSubmissionKey(storeId: string, customerKey: string, items: Array<{ productId?: string; variantId?: string | null; quantity?: number; price?: number }>): string {
  const body = [...items]
    .map(i => `${i.productId || ''}/${i.variantId || ''}x${i.quantity || 0}@${Number(i.price || 0).toFixed(2)}`)
    .sort()
    .join('|');
  const src = `${storeId}#${customerKey}#${body}`;
  let h1 = 0x811c9dc5, h2 = 0x12345678;
  for (let i = 0; i < src.length; i++) {
    const c = src.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2654435761) >>> 0;
  }
  return `cart-${h1.toString(36)}${h2.toString(36)}`;
}
