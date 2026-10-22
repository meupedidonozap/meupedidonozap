import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PaymentGatewaySettings {
  provider: 'ton' | 'outro' | 'mercadopago';
  pixEnabled: boolean;
  pixKey: string;
  pixName: string;
  pixCity: string;
  cardEnabled: boolean;
}

export const defaultPaymentGateway: PaymentGatewaySettings = {
  provider: 'ton', pixEnabled: false, pixKey: '', pixName: '', pixCity: '', cardEnabled: false,
};

export function getPaymentGateway(settings: any): PaymentGatewaySettings {
  return { ...defaultPaymentGateway, ...(settings?.paymentGateway || {}) };
}

export function PaymentSettingsCard({ storeId, settings }: { storeId: string; settings: any }) {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<PaymentGatewaySettings>(getPaymentGateway(settings));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCfg(getPaymentGateway(settings)); }, [settings]);
  const set = (patch: Partial<PaymentGatewaySettings>) => setCfg(c => ({ ...c, ...patch }));

  const save = async () => {
    if (cfg.provider !== 'mercadopago' && cfg.pixEnabled && (!cfg.pixKey.trim() || !cfg.pixName.trim() || !cfg.pixCity.trim())) {
      toast.error('Para ativar o PIX, preencha chave, nome do recebedor e cidade.');
      return;
    }
    setSaving(true);
    const { data: current } = await supabase.from('stores').select('settings').eq('id', storeId).single();
    const { error } = await supabase.from('stores')
      .update({ settings: { ...((current?.settings as any) || {}), paymentGateway: cfg } as any })
      .eq('id', storeId).select().single();
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar: ' + error.message); return; }
    qc.invalidateQueries();
    toast.success('Pagamentos salvos!');
  };

  return (
    <Card>
      <CardHeader><CardTitle>Recebimento por PIX e Cartão</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 sm:max-w-xs">
          <Label>Conta de recebimento</Label>
          <Select value={cfg.provider} onValueChange={v => set({ provider: v as any })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mercadopago">Mercado Pago (confirmação automática)</SelectItem>
              <SelectItem value="ton">TON</SelectItem>
              <SelectItem value="outro">Outro banco / conta PJ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Switch checked={cfg.pixEnabled} onCheckedChange={v => set({ pixEnabled: v })} />
            Receber PIX na finalização do pedido
          </label>
          <p className="text-xs text-muted-foreground">O cliente vê o QR Code e o "copia e cola" com o valor exato do pedido. O dinheiro cai direto na sua conta.</p>
          {cfg.provider !== 'mercadopago' && <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1"><Label>Chave PIX</Label><Input value={cfg.pixKey} onChange={e => set({ pixKey: e.target.value })} placeholder="CNPJ, e-mail, celular ou aleatória" /></div>
            <div className="space-y-1"><Label>Nome do recebedor</Label><Input value={cfg.pixName} onChange={e => set({ pixName: e.target.value })} placeholder="Como aparece no banco" /></div>
            <div className="space-y-1"><Label>Cidade</Label><Input value={cfg.pixCity} onChange={e => set({ pixCity: e.target.value })} /></div>
          </div>}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            <Switch checked={cfg.cardEnabled} onCheckedChange={v => set({ cardEnabled: v })} />
            Aceitar Cartão
          </label>
          {cfg.provider === 'mercadopago' ? <p className="text-xs text-muted-foreground">O cliente paga o cartão na página segura do Mercado Pago.</p> : <p className="text-xs text-muted-foreground">O pedido chega como "Aguardando pagamento" e você envia ao cliente, pelo WhatsApp, o Link de Pagamento gerado no app {cfg.provider === 'ton' ? 'TON' : 'do seu banco'} com o valor do pedido.</p>}
        </div>

        <p className="text-xs text-muted-foreground">{cfg.provider === 'mercadopago' ? 'Com Mercado Pago, o pedido é marcado como pago sozinho quando o pagamento é aprovado.' : <>Ao receber, abra o pedido em Pedidos e clique em "Marcar como pago".</>}</p>
        <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
      </CardContent>
    </Card>
  );
}
