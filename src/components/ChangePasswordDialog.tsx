import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function ChangePasswordDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setCurrent(''); setPassword(''); setConfirm(''); };

  const handleSave = async () => {
    if (!current) return toast.error('Informe a senha atual');
    if (password.length < 8) return toast.error('A nova senha deve ter no mínimo 8 caracteres');
    if (password !== confirm) return toast.error('As senhas não conferem');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('Sessão expirada. Entre novamente.');
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
      if (signErr) throw new Error('Senha atual incorreta');
      const { error } = await supabase.auth.updateUser({ password, current_password: current } as any);
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      reset();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar senha');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={triggerClassName}>
          <KeyRound className="h-4 w-4 mr-1" />
          Alterar senha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Redefinir minha senha</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="cp-current">Senha atual</Label>
            <Input id="cp-current" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-new">Nova senha</Label>
            <Input id="cp-new" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cp-confirm">Confirmar nova senha</Label>
            <Input id="cp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar nova senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
