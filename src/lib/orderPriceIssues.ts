import type { CartItem } from '@/types';
import type { PriceTable } from './pricing';

export type OrderPriceIssue = {
  items: Pick<CartItem, 'productId' | 'variantId' | 'name' | 'code' | 'color' | 'size'>[];
  table: PriceTable;
  description: string;
  orderNumber?: number | string;
  title?: string;
};

let current: OrderPriceIssue | null = null;
const listeners = new Set<() => void>();
export const getOrderPriceIssues = () => current;
export function subscribeOrderPriceIssues(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function closeOrderPriceIssues() {
  current = null;
  listeners.forEach(listener => listener());
}

/** Presentation only: other stores retain their existing notices and behavior. */
export function reportOrderPriceIssues(issue: OrderPriceIssue, slug = window.location.pathname.split('/')[1]) {
  if (slug !== 'dicolore' || !issue.items.length) return false;
  current = { ...issue, items: [...issue.items] };
  // Callers can be cart state updaters; notify after that update completes.
  queueMicrotask(() => listeners.forEach(listener => listener()));
  return true;
}