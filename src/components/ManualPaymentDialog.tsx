import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ManualPaymentDialog({ order, onClose }: { order: { id: string; orderNumber: number } | null; onClose: () => void }) {
  const [method, setMethod] = useState('pix');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const save = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('Faça login novamente.');
      const { error } = await supabase.rpc('record_manual_order_payment', { p_order_id: order.id, p_method: method, p_note: note });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Pagamento registrado como Pago (Manual).');
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível registrar o pagamento.'); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!order} onOpenChange={v => { if (!v && !busy) onClose(); }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Registrar pagamento — #{order?.orderNumber}</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">Confirme somente após conferir o recebimento. O pedido ficará pago e liberado para envio ao Bling.</p>
    <Label>Forma recebida</Label><Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
      <SelectItem value="pix">PIX direto na conta</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem><SelectItem value="cartao_maquininha">Cartão na maquininha</SelectItem><SelectItem value="transferencia">Transferência</SelectItem><SelectItem value="boleto">Boleto recebido</SelectItem>
    </SelectContent></Select><Label htmlFor="manual-note">Observação interna</Label><Textarea id="manual-note" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
    <Button disabled={busy} onClick={save}>{busy ? 'Registrando…' : 'Confirmar recebimento e marcar PAGO'}</Button>
  </DialogContent></Dialog>;
}