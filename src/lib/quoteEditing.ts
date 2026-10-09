import { useEffect, useState } from 'react';

/** Orçamento (status 'orcamento') sendo editado pelo vendedor no carrinho. */
export interface EditingQuote {
  id: string;
  storeId: string;
  customerName: string;
  /** true quando o próprio cliente está corrigindo um pedido devolvido para orçamento. */
  byCustomer?: boolean;
}

const KEY = 'seller_editing_quote';
const EVT = 'editing-quote-change';

export function getEditingQuote(storeId?: string): EditingQuote | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const q = raw ? (JSON.parse(raw) as EditingQuote) : null;
    if (!q || (storeId && q.storeId !== storeId)) return null;
    return q;
  } catch { return null; }
}

export function setEditingQuote(q: EditingQuote | null) {
  try {
    if (q) sessionStorage.setItem(KEY, JSON.stringify(q));
    else sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function useEditingQuote(storeId?: string) {
  const [q, setQ] = useState<EditingQuote | null>(() => getEditingQuote(storeId));
  useEffect(() => {
    const h = () => setQ(getEditingQuote(storeId));
    h();
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, [storeId]);
  return q;
}
