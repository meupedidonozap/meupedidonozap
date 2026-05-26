import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function ChangePasswordCard() {
  const { user } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (pw !== pw2) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setLoading(false);
    if (error) {
      toast.error(error.message || 'Erro ao atualizar senha');
      return;
    }
    setPw('');
    setPw2('');
    toast.success('Senha atualizada com sucesso');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" /> Trocar Senha
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label>Sua conta</Label>
            <Input value={user?.email ?? ''} disabled readOnly />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-pw">Nova senha</Label>
              <Input
                id="new-pw"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-pw2">Confirmar nova senha</Label>
              <Input
                id="new-pw2"
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                minLength={6}
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Atualizar Senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}