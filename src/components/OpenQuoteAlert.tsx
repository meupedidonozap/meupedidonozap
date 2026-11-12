import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatCurrency } from '@/lib/formatters';
import { canEditOrder, mergeEditedCustomer } from '@/lib/orderOwnership';
import { setEditingQuote } from '@/lib/quoteEditing';
import { loadItemsForEdit } from '@/lib/editRecalc';
import { resolveStorePriceTable } from '@/lib/pricing';
import { useCart } from '@/contexts/CartContext';

interface Props {
  storeId: string;
  storeSlug: string;
  customer: { id?: string; name?: string; customerCode?: string; cpfCnpj?: string } | null;
  seller: { isAdmin?: boolean; isTelevendas?: boolean; name?: string; erpCode?: string };
  disabled?: boolean;
}

/** DiColore: avisa o vendedor quando o cliente escolhido já tem orçamento aberto. */
export default function OpenQuoteAlert({ storeId, storeSlug, customer, seller, disabled }: Props) {
  const navigate = useNavigate();
  const { clearCart, addItem, setStoreId } = useCart();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const checked = useRef<string | null>(null);
  const key = customer?.customerCode || customer?.cpfCnpj || customer?.id || '';

  useEffect(() => {
    if (disabled || !key || checked.current === key) return;
    checked.current = key;
    let cancel = false;
    (async () => {
      let q = supabase.from('orders').select('id, order_number, total, created_at, customer, origem, items, status')
        .eq('store_id', storeId).eq('status', 'orcamento').order('created_at', { ascending: false }).limit(1);
      if (customer?.customerCode) q = q.filter('customer->>customerCode', 'eq', customer.customerCode);
      else if (customer?.cpfCnpj) q = q.filter('customer->>cpfCnpj', 'eq', customer.cpfCnpj);
      else return;
      const { data } = await q;
      if (!cancel && data?.[0]) setQuote(data[0]);
    })();
    return () => { cancel = true; };
  }, [key, disabled, storeId]);

  async function edit() {
    if (!quote) return;
    setLoading(true);
    try {
      if (!canEditOrder(quote, seller)) throw new Error('Este orçamento já foi assumido por outro responsável');
      const claimed = mergeEditedCustomer(quote, quote.customer, seller);
      if (claimed !== quote.customer) {
        const { error } = await supabase.from('orders').update({ customer: claimed } as any).eq('id', quote.id).eq('status', 'orcamento').select().single();
        if (error) throw error;
      }
      setStoreId(storeId);
      clearCart();
      const recalc = await loadItemsForEdit(storeId, (quote.items as any[]) || [], resolveStorePriceTable(storeSlug, quote.customer?.priceTable));
      for (const it of recalc.items) addItem(it);
      setEditingQuote({ id: quote.id, storeId, customerName: customer?.name || quote.customer?.name || '' });
      toast.success(`Orçamento #${quote.order_number} carregado para edição`);
      setQuote(null);
      navigate(`/${storeSlug}`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao abrir orçamento');
    } finally { setLoading(false); }
  }

  return (
    <AlertDialog open={!!quote} onOpenChange={(o) => !o && setQuote(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Orçamento já aberto</AlertDialogTitle>
          <AlertDialogDescription>
            Este cliente já tem o orçamento #{quote?.order_number} aberto
            {quote ? ` (${formatCurrency(Number(quote.total) || 0)})` : ''}. Para não duplicar, edite este orçamento (ou cancele-o antes de criar outro).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Fechar</AlertDialogCancel>
          <AlertDialogAction disabled={loading} onClick={(e) => { e.preventDefault(); edit(); }}>
            Editar #{quote?.order_number}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
