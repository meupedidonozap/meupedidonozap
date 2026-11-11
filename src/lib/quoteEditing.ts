import { useEffect, useState } from 'react';

/** Orçamento (status 'orcamento') sendo editado pelo vendedor no carrinho. */
export interface EditingQuote {
  id: string;
  storeId: string;
  customerName: string;
  /** true quando o próprio cliente está corrigindo um pedido devolvido para orçamento. */
  byCustomer?: boolean;
}

// Guardado no aparelho (como o carrinho): sobrevive a recarga/fechar app,
// evitando que o "Salvar" de uma edição crie um orçamento novo.
const KEY = 'seller_editing_quote';
const EVT = 'editing-quote-change';

export function getEditingQuote(storeId?: string): EditingQuote | null {
  try {
    const raw = localStorage.getItem(KEY);
    const q = raw ? (JSON.parse(raw) as EditingQuote) : null;
    if (!q || (storeId && q.storeId !== storeId)) return null;
    return q;
  } catch { return null; }
}

export function setEditingQuote(q: EditingQuote | null) {
  try {
    if (q) localStorage.setItem(KEY, JSON.stringify(q));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}

export function useEditingQuote(storeId?: string) {
  const [q, setQ] = useState<EditingQuote | null>(() => getEditingQuote(storeId));
  useEffect(() => {
    const h = () => setQ(getEditingQuote(storeId));
    h();
    const st = (e: StorageEvent) => { if (e.key === KEY) h(); };
    window.addEventListener(EVT, h);
    window.addEventListener('storage', st);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener('storage', st); };
  }, [storeId]);
  return q;
}
