import { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StoreAdminLoginProps {
  storeName: string;
}

export default function StoreAdminLogin({ storeName }: StoreAdminLoginProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [sending, setSending] = useState(false);

  const handleForgot = async () => {
    const target = email.trim();
    if (!target) {
      toast.error('Digite seu email acima para receber o link');
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setSending(false);
    if (error) {
      toast.error('Não foi possível enviar o link. Tente novamente em alguns minutos.');
      return;
    }
    toast.success('Enviamos um link para redefinir a senha. Confira seu email (e o spam).');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast.error('Email ou senha inválidos');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{storeName}</CardTitle>
          <p className="text-sm text-muted-foreground">Acesso administrativo</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
              Entrar
            </Button>
            <button
              type="button"
              onClick={handleForgot}
              disabled={sending}
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
            >
              {sending ? 'Enviando link...' : 'Esqueceu a senha?'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
