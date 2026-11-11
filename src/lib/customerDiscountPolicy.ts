import { computeGroupDiscounts } from './groupDiscounts';
import { repriceItems } from './repriceOrder';
import type { CartItem, DiscountRule } from '@/types';
import type { PriceTable } from './pricing';

export function customerDiscountsBlocked(slug?: string | null, customer?: { noDiscount?: boolean } | null): boolean {
  return slug === 'dicolore' && customer?.noDiscount === true;
}

export function canRecalculateOrder(order: { status: string; xmlDownloadedAt?: unknown; erpSentAt?: unknown; erpOrderCode?: unknown }): boolean {
  return ['orcamento', 'pendente'].includes(order.status) && !order.xmlDownloadedAt && !order.erpSentAt && !order.erpOrderCode;
}

export function calculateCustomerOrder(items: CartItem[], products: any[], rules: DiscountRule[], table: PriceTable, blocked: boolean) {
  const repriced = repriceItems(items, products, table);
  if (repriced.missing.length) throw new Error('Há itens sem preço na tabela do cliente. Nenhum recálculo foi salvo.');
  const { quantityDiscount, itemDiscounts } = computeGroupDiscounts(repriced.items, rules, table, blocked);
  const stamped = repriced.items.map(it => ({ ...it, discountPercent: itemDiscounts[`${it.productId}-${it.variantId || ''}`] || 0 }));
  const subtotal = stamped.reduce((s, it) => s + it.price * it.quantity, 0);
  return { items: stamped, subtotal, discount: quantityDiscount };
}