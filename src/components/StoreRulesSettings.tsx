import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getStoreRules } from '@/lib/storeRules';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export default function StoreRulesSettings({ store }: { store: any }) {
  const qc = useQueryClient();
  const [rules, setRules] = useState(getStoreRules(store.slug, store.settings));
  const [saving, setSaving] = useState(false);
  useEffect(() => setRules(getStoreRules(store.slug, store.settings)), [store.slug, store.settings]);
  async function save() {
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error('Faça login novamente.');
      const { data: current, error: readError } = await supabase.from('stores').select('settings').eq('id', store.id).single();
      if (readError) throw readError;
      const { error } = await supabase.from('stores').update({ settings: { ...(current.settings as any), rules } as any }).eq('id', store.id).select().single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['stores'] });
      qc.invalidateQueries({ queryKey: ['store'] });
      qc.invalidateQueries();
      toast.success('Manual e regras da loja salvos');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4 border-t pt-6">
    <h2 className="text-xl font-semibold">Manual e regras — {store.name}</h2>
    <p className="text-sm text-muted-foreground">Identificador da loja: <strong>{store.slug}</strong></p>
    {store.slug === 'dicolore' && <>
      <div className="flex items-center justify-between gap-4 border-b py-3"><Label htmlFor="require-release-payment">Exigir forma e condição de pagamento para liberar</Label><Switch id="require-release-payment" checked={rules.requireReleasePayment} onCheckedChange={v => setRules(r => ({ ...r, requireReleasePayment: v }))} /></div>
      <div className="flex items-center justify-between gap-4 border-b py-3"><Label htmlFor="notify-release-whatsapp">Avisar liberação pelo WhatsApp com número do pedido</Label><Switch id="notify-release-whatsapp" checked={rules.notifyReleaseWhatsapp} onCheckedChange={v => setRules(r => ({ ...r, notifyReleaseWhatsapp: v }))} /></div>
      <h3 className="font-semibold">Regras protegidas</h3>
      <ul className="list-disc space-y-2 pl-5 text-sm">
        <li>Cliente finaliza como Pendente; somente equipe autorizada libera após análise.</li>
        <li>O primeiro colaborador que salva assume o pedido; outros membros não editam nem finalizam, salvo administrador.</li>
        <li>A autoria do cliente é preservada e o responsável é mostrado separadamente.</li>
        <li>Editar e salvar atualiza o mesmo orçamento, sem criar outro número.</li>
        <li>Repetir o salvamento do mesmo carrinho não cria cópias.</li>
        <li>Cadastro, produtos e estoque são mantidos pela loja/ERP; cliente não altera cadastro.</li>
        <li>Vendedor e televendas não têm pedido mínimo; cliente mantém o mínimo configurado.</li>
      </ul>
    </>}
    <div className="space-y-2"><Label htmlFor="store-rule-manual">Regras adicionais da loja</Label><Textarea id="store-rule-manual" rows={6} value={rules.manual} onChange={e => setRules(r => ({ ...r, manual: e.target.value }))} /></div>
    <Button disabled={saving} onClick={save}><Save className="mr-2 h-4 w-4" />Salvar manual e regras</Button>
  </section>;
}