import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { mapOrder } from '@/hooks/useOrders';
import { calculateCustomerOrder, canRecalculateOrder } from '@/lib/customerDiscountPolicy';
import { resolveStorePriceTable } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

export default function RecalculateOrderButton({ order, store, products }: { order: any; store: any; products: any[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (store.slug !== 'dicolore' || !canRecalculateOrder(order)) return null;
  async function recalculate() {
    if (!confirm(`Recalcular o pedido #${order.orderNumber} com a tabela e a regra de desconto atuais do cliente?`)) return;
    setBusy(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Faça login novamente.');
      const { data: row, error: readError } = await supabase.from('orders').select('*').eq('id', order.id).eq('store_id', store.id).single();
      if (readError) throw readError;
      const current = mapOrder(row);
      if (!canRecalculateOrder(current)) throw new Error('Este pedido não pode mais ser recalculado.');
      const code = String(current.customer.customerCode || '').trim();
      let query = supabase.from('customer_profiles').select('*').eq('store_id', store.id);
      if (code) query = query.eq('customer_code', code);
      else if (row.user_id) query = query.eq('user_id', row.user_id);
      else if (current.customer.cpfCnpj) query = query.eq('cpf_cnpj', current.customer.cpfCnpj);
      else throw new Error('Cadastro do cliente não encontrado.');
      const { data: profiles, error: profileError } = await query.order('no_discount', { ascending: false }).order('created_at').limit(5);
      if (profileError) throw profileError;
      const profile = profiles?.[0];
      if (!profile) throw new Error('Cadastro do cliente não encontrado.');
      const table = resolveStorePriceTable(store.slug, profile.price_table);
      const calculated = calculateCustomerOrder(current.items, products, store.settings.discountRules || [], table, profile.no_discount);
      const { data, error } = await supabase.rpc('recalculate_customer_order', { p_order_id: order.id, p_items: calculated.items as any, p_discount: calculated.discount, p_table: table });
      if (error) throw error;
      if (!data) throw new Error('O pedido não foi recalculado.');
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['seller-orders'] });
      toast.success(`Pedido #${order.orderNumber} recalculado sem criar outro pedido`);
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  return <Button variant="outline" size="sm" title="Recalcular com o cadastro atual do cliente" disabled={busy} onClick={recalculate}><RefreshCw className={`mr-1 h-3 w-3 ${busy ? 'animate-spin' : ''}`} />Recalcular</Button>;
}