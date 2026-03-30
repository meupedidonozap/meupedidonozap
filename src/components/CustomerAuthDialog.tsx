import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUpsertCustomerProfile } from '@/hooks/useCustomerProfile';
import { supabase } from '@/integrations/supabase/client';
import { fetchAddressByCep } from '@/lib/cepLookup';
import { formatPhone, formatCEP } from '@/lib/formatters';

const brazilianStates = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

interface CustomerAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
}

export default function CustomerAuthDialog({ open, onOpenChange, storeId }: CustomerAuthDialogProps) {
  const { signIn, signUp, user } = useAuth();
  const upsertProfile = useUpsertCustomerProfile();
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ email: '', password: '', confirmPassword: '' });
  const [profileData, setProfileData] = useState({
    name: '', whatsapp: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
  });

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
    }
  }, [open]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.email || !loginData.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setLoading(true);
    const { error } = await signIn(loginData.email, loginData.password);
    setLoading(false);
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message);
    } else {
      toast.success('Login realizado!');
      onOpenChange(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerData.email || !registerData.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (registerData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (registerData.password !== registerData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    const { user: newUser, error } = await signUp(registerData.email, registerData.password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else if (newUser) {
      setPendingUserId(newUser.id);
      toast.success('Conta criada! Preencha seus dados.');
      setStep(2);
    } else {
      toast.error('Erro ao criar conta. Tente novamente.');
    }
  };

  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setProfileData(prev => ({ ...prev, cep: formatted }));
    const cleaned = formatted.replace(/\D/g, '');
    if (cleaned.length === 8) {
      setCepLoading(true);
      const result = await fetchAddressByCep(cleaned);
      setCepLoading(false);
      if (result) {
        setProfileData(prev => ({
          ...prev,
          uf: result.uf,
          city: result.city,
          neighborhood: result.neighborhood,
          address: result.address,
        }));
      } else {
        toast.error('CEP não encontrado');
      }
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name || !profileData.whatsapp || !profileData.uf || !profileData.city || !profileData.address) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    const effectiveUserId = user?.id ?? pendingUserId;
    if (!effectiveUserId) {
      toast.error('Erro de autenticação. Tente novamente.');
      return;
    }
    setLoading(true);
    try {
      await upsertProfile.mutateAsync({
        userId: effectiveUserId,
        storeId,
        name: profileData.name,
        cpfCnpj: '',
        whatsapp: profileData.whatsapp,
        cep: profileData.cep,
        uf: profileData.uf,
        city: profileData.city,
        neighborhood: profileData.neighborhood,
        address: profileData.address,
        number: profileData.number,
        complement: profileData.complement || undefined,
      });
      toast.success('Cadastro completo!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Entrar ou Cadastrar' : 'Complete seu Cadastro'}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input id="login-password" type="password" value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} placeholder="••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input id="reg-email" type="email" value={registerData.email} onChange={e => setRegisterData(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-password">Senha</Label>
                  <Input id="reg-password" type="password" value={registerData.password} onChange={e => setRegisterData(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reg-confirm">Confirmar Senha</Label>
                  <Input id="reg-confirm" type="password" value={registerData.confirmPassword} onChange={e => setRegisterData(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repita a senha" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        ) : (
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">Preencha seus dados para finalizar o cadastro.</p>

            <div className="grid gap-2">
              <Label htmlFor="prof-name">Nome completo *</Label>
              <Input id="prof-name" value={profileData.name} onChange={e => setProfileData(p => ({ ...p, name: e.target.value.toUpperCase() }))} placeholder="NOME COMPLETO" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prof-whatsapp">WhatsApp *</Label>
              <Input id="prof-whatsapp" value={profileData.whatsapp} onChange={e => setProfileData(p => ({ ...p, whatsapp: formatPhone(e.target.value) }))} placeholder="(47) 99999-9999" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="prof-cep">CEP</Label>
                <div className="relative">
                  <Input id="prof-cep" value={profileData.cep} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" />
                  {cepLoading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prof-uf">UF *</Label>
                <Select value={profileData.uf} onValueChange={value => setProfileData(p => ({ ...p, uf: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{brazilianStates.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="prof-city">Cidade *</Label>
                <Input id="prof-city" value={profileData.city} onChange={e => setProfileData(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prof-neighborhood">Bairro</Label>
                <Input id="prof-neighborhood" value={profileData.neighborhood} onChange={e => setProfileData(p => ({ ...p, neighborhood: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="prof-address">Endereço *</Label>
                <Input id="prof-address" value={profileData.address} onChange={e => setProfileData(p => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prof-number">Número</Label>
                <Input id="prof-number" value={profileData.number} onChange={e => setProfileData(p => ({ ...p, number: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prof-complement">Complemento</Label>
              <Input id="prof-complement" value={profileData.complement} onChange={e => setProfileData(p => ({ ...p, complement: e.target.value }))} />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar e Continuar
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
