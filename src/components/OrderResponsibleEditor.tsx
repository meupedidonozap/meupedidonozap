import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRoundCog } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getOrderOwner } from '@/lib/orderOwnership';
import { canChangeOrderResponsible, canUnlinkOrderResponsible } from '@/lib/orderResponsible';
import type { Order } from '@/types';
import { mapOrder } from '@/hooks/useOrders';

export default function OrderResponsibleEditor({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const owner = getOrderOwner(order);
  const editable = canChangeOrderResponsible(order);
  const { data: staff = [], isLoading, error } = useQuery({
    queryKey: ['order-responsible-staff', order.storeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('store_users').select('id,name,role')
        .eq('store_id', order.storeId).eq('is_active', true).in('role', ['vendedor', 'televendas']).order('name');
      if (error) throw error;
      return data;
    },
    enabled: editable,
  });

  const save = async () => {
    if (!selected || !editable || saving) return;
    const unlink = selected === 'unlinked';
    if (!window.confirm(unlink ? `Desvincular o responsável pelo pedido #${order.orderNumber}?` : `Alterar o responsável pelo pedido #${order.orderNumber}?`)) return;
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Faça login novamente para alterar o responsável.');
      const { data, error } = await supabase.rpc('set_dicolore_order_responsible', {
        p_order_id: order.id,
        p_store_user_id: unlink ? null : selected,
        p_expected_customer: order.customer as any,
      });
      if (error) throw error;
      if (!data) throw new Error('Não foi possível confirmar a alteração.');
      const updated = mapOrder(data);
      qc.setQueryData<Order[]>(['orders', order.storeId], old => old?.map(o => o.id === order.id ? updated : o));
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['seller-orders'] });
      void qc.invalidateQueries({ queryKey: ['audit-log'] });
      toast.success(unlink ? 'Responsável desvinculado!' : 'Responsável alterado!');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (err as { message?: string })?.message || 'Erro ao alterar responsável');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2 border-b pb-4" aria-label="Responsável pelo pedido">
      <Label htmlFor="order-responsible">Responsável pelo pedido</Label>
      <p className="text-sm text-muted-foreground">{owner.name || 'Sem responsável'}{owner.role ? ` · ${owner.role === 'televendas' ? 'Televendas' : 'Vendedor'}` : ''}</p>
      {editable ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={selected} onValueChange={setSelected} disabled={saving || isLoading || !!error}>
            <SelectTrigger id="order-responsible" className="min-w-0 flex-1"><SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecionar responsável'} /></SelectTrigger>
            <SelectContent>
              {canUnlinkOrderResponsible(order) && <SelectItem value="unlinked">Sem responsável — desvincular</SelectItem>}
              {staff.map(person => <SelectItem key={person.id} value={person.id}>{person.name} · {person.role === 'televendas' ? 'Televendas' : 'Vendedor'}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" disabled={!selected || saving || !!error} onClick={save}>
            <UserRoundCog className="mr-2 h-4 w-4" />{saving ? 'Salvando...' : 'Alterar responsável'}
          </Button>
        </div>
      ) : <p className="text-sm text-muted-foreground">Pedido bloqueado para alteração de responsável após liberação ou transmissão.</p>}
      {error && <p role="alert" className="text-sm text-destructive">Não foi possível carregar os responsáveis.</p>}
    </section>
  );
}