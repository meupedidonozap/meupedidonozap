import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  storeId: string;
  product: { id: string; name: string; code?: string } | null;
  userId?: string | null;
  profile?: { id?: string; name?: string; whatsapp?: string } | null;
  email?: string | null;
}

export function NotifyMeDialog({ open, onOpenChange, storeId, product, userId, profile, email }: Props) {
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(profile?.name || ''); setMail(email || ''); setPhone(profile?.whatsapp || ''); }
  }, [open, profile, email]);

  const save = async () => {
    if (!product) return;
    const digits = phone.replace(/\D/g, '');
    if (!name.trim()) { toast.error('Informe seu nome.'); return; }
    if (!mail.trim() && digits.length < 10) { toast.error('Informe seu WhatsApp ou e-mail.'); return; }
    setSaving(true);
    const { error } = await supabase.from('product_wishlist').insert({
      store_id: storeId, product_id: product.id, product_name: product.name, product_code: product.code || '',
      customer_name: name.trim(), email: mail.trim() || null, whatsapp: digits || null,
      user_id: userId || null, customer_profile_id: profile?.id || null,
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível registrar: ' + error.message); return; }
    toast.success('Pronto! Avisaremos quando o produto chegar.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Avise-me quando chegar</DialogTitle>
          <DialogDescription>{product?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>WhatsApp</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" inputMode="tel" /></div>
          <div><Label>E-mail</Label><Input value={mail} onChange={e => setMail(e.target.value)} type="email" /></div>
          {userId && <p className="text-xs text-muted-foreground">Com as notificações ativadas, você também recebe um aviso no aparelho.</p>}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Quero ser avisado'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
