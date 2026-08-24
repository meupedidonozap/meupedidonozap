import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useUpsertCustomerProfile } from '@/hooks/useCustomerProfile';
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
  storeSlug?: string;
}

type Step = 'auth' | 'profile' | 'forgot';

export default function CustomerAuthDialog({ open, onOpenChange, storeId, storeSlug }: CustomerAuthDialogProps) {
  const { signIn, signUp, user } = useAuth();
  const upsertProfile = useUpsertCustomerProfile();
  const showCodeTab = storeSlug === 'dicolore';
  const [loading, setLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [step, setStep] = useState<Step>('auth');
  const [authTab, setAuthTab] = useState<'code' | 'login' | 'register'>(showCodeTab ? 'code' : 'login');
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [codeLoginData, setCodeLoginData] = useState({ codigo: '', password: '' });
  const [showCodePwd, setShowCodePwd] = useState(false);
  const [registerData, setRegisterData] = useState({ email: '', password: '' });
  const [forgotEmail, setForgotEmail] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '', whatsapp: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
  });

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('auth');
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

  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = codeLoginData.codigo.trim();
    const password = codeLoginData.password.trim();
    if (!codigo || !password) {
      toast.error('Preencha código e senha');
      return;
    }
    const slug = (storeSlug || window.location.pathname.split('/').filter(Boolean)[0] || 'loja');
    const email = buildCustomerEmail(codigo, slug);
    setLoading(true);
    let { error } = await signIn(email, password);
    // Senhas curtas (ex.: código de 5 dígitos) são completadas internamente.
    if (error) {
      const fallback = buildCustomerPassword(password);
      if (fallback !== password) {
        const retry = await signIn(email, fallback);
        error = retry.error;
      }
    }
    setLoading(false);
    if (error) {
      toast.error('Código ou senha incorretos. Confira com o seu representante.');
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
    setLoading(true);
    const { hasSession, error } = await signUp(registerData.email, registerData.password);
    setLoading(false);
    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('user already exists') ||
        (error as any).code === 'user_already_exists'
      ) {
        toast.info('Você já tem cadastro. Faça login com sua senha.');
        setLoginData({ email: registerData.email, password: '' });
        setAuthTab('login');
      } else if (msg.includes('password')) {
        toast.error('Senha inválida. Use pelo menos 6 caracteres.');
      } else {
        toast.error(error.message);
      }
    } else if (hasSession) {
      toast.success('Conta criada! Preencha seus dados.');
      setStep('profile');
    } else {
      toast.error('Não foi possível criar a conta. Tente novamente.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error('Informe o email');
      return;
    }
    setLoading(true);
    const slug = storeSlug || window.location.pathname.split('/').filter(Boolean)[0] || '';
    const redirectTo = slug
      ? `${window.location.origin}/${slug}/redefinir-senha`
      : `${window.location.origin}/redefinir-senha`;
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Link enviado! Verifique seu email.');
      setForgotEmail('');
      setStep('auth');
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
    if (!user?.id) {
      toast.error('Sessão não encontrada. Feche esta janela, faça login e tente novamente.');
      return;
    }
    setLoading(true);
    try {
      await upsertProfile.mutateAsync({
        userId: user.id,
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
      const msg = err.message?.includes('row-level security')
        ? 'Sua sessão expirou. Feche esta janela, faça login novamente e tente salvar.'
        : err.message || 'Erro ao salvar perfil';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'auth' && 'Entrar ou Cadastrar'}
            {step === 'profile' && 'Complete seu Cadastro'}
            {step === 'forgot' && 'Redefinir Senha'}
          </DialogTitle>
        </DialogHeader>

        {step === 'auth' && (
          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'code' | 'login' | 'register')}>
            <TabsList className={`grid w-full ${showCodeTab ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {showCodeTab && <TabsTrigger value="code">Código/Usuário</TabsTrigger>}
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Cadastrar</TabsTrigger>
            </TabsList>
            {showCodeTab && <TabsContent value="code">
              <form onSubmit={handleCodeLogin} className="space-y-4 pt-4">
                <p className="text-xs text-muted-foreground">
                  Já é cliente? Entre com o <strong>código ou usuário</strong> e a <strong>senha</strong> que seu representante enviou.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="code-login">Código ou usuário</Label>
                  <Input id="code-login" autoFocus value={codeLoginData.codigo} onChange={e => setCodeLoginData(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: 96133 ou ervadoce" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="code-pwd">Senha</Label>
                  <div className="relative">
                    <Input id="code-pwd" type={showCodePwd ? 'text' : 'password'} value={codeLoginData.password} onChange={e => setCodeLoginData(p => ({ ...p, password: e.target.value }))} placeholder="Senha enviada pelo representante" className="pr-10" />
                    <button type="button" onClick={() => setShowCodePwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showCodePwd ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showCodePwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
              </form>
            </TabsContent>}
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginData.email} onChange={e => setLoginData(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Input id="login-password" type={showLoginPwd ? 'text' : 'password'} value={loginData.password} onChange={e => setLoginData(p => ({ ...p, password: e.target.value }))} placeholder="••••••" className="pr-10" />
                    <button type="button" onClick={() => setShowLoginPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showLoginPwd ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Entrar
                </Button>
                <button
                  type="button"
                  onClick={() => setStep('forgot')}
                  className="block w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Esqueci minha senha
                </button>
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
                  <div className="relative">
                    <Input id="reg-password" type={showRegPwd ? 'text' : 'password'} value={registerData.password} onChange={e => setRegisterData(p => ({ ...p, password: e.target.value }))} placeholder="Crie uma senha simples (mín. 6 caracteres)" className="pr-10" />
                    <button type="button" onClick={() => setShowRegPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showRegPwd ? 'Ocultar senha' : 'Mostrar senha'}>
                      {showRegPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Dica: use algo fácil de lembrar, ex: seunome123</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        )}

        {step === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enviaremos um link no seu email para criar uma nova senha.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="forgot-email">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enviar link
            </Button>
            <button
              type="button"
              onClick={() => setStep('auth')}
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Voltar
            </button>
          </form>
        )}

        {step === 'profile' && (
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
