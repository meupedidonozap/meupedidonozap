import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, Store, Settings, Eye, ToggleLeft, ToggleRight, Search, Loader2, UserPlus, LogOut, ShieldAlert } from 'lucide-react';
import { useStores, useCreateStore, useUpdateStore, useDeleteStore, useSwapStoreOrder } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import type { Store as StoreType, StoreType as StoreTypeEnum } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useAuth } from '@/hooks/useAuth';
import StoreAdminLogin from '@/components/StoreAdminLogin';
import RefreshButton from '@/components/RefreshButton';
import { getTemplateForType } from '@/lib/storeTemplates';
import { getLicenseStatus } from '@/lib/licenseStatus';

const storeTypeLabels: Record<StoreTypeEnum, string> = {
  LOJA: 'Loja de Produtos',
  ACESSORIOS: 'Acessórios',
  COMIDA: 'Delivery de Comida',
  SERVICOS: 'Serviços',
  PIZZARIA: 'Pizzaria',
  SALAO: 'Salão de Beleza',
};

const storeTypeBadgeColors: Record<StoreTypeEnum, string> = {
  LOJA: 'bg-blue-100 text-blue-700',
  ACESSORIOS: 'bg-purple-100 text-purple-700',
  COMIDA: 'bg-orange-100 text-orange-700',
  SERVICOS: 'bg-teal-100 text-teal-700',
  PIZZARIA: 'bg-red-100 text-red-700',
  SALAO: 'bg-pink-100 text-pink-700',
};

const defaultSettings = {
  primaryColor: '#1a2332',
  accentColor: '#22c55e',
  deliveryFee: 0,
  minOrderValue: 0,
  acceptPix: true,
  acceptCard: true,
  acceptBoleto: false,
  workingHours: {
    monday: { open: '08:00', close: '18:00', isOpen: true },
    tuesday: { open: '08:00', close: '18:00', isOpen: true },
    wednesday: { open: '08:00', close: '18:00', isOpen: true },
    thursday: { open: '08:00', close: '18:00', isOpen: true },
    friday: { open: '08:00', close: '18:00', isOpen: true },
    saturday: { open: '08:00', close: '12:00', isOpen: true },
    sunday: { open: '00:00', close: '00:00', isOpen: false },
  },
  discountRules: [],
};

export default function AdminPage() {
  const { user, isAdmin, loading: adminLoading } = usePlatformAdmin();
  const { signOut } = useAuth();

  // Show loading
  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not logged in - show login
  if (!user) {
    return <StoreAdminLogin storeName="MeuPedidoNoZap - Admin" />;
  }

  // Logged in but not platform admin
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar o painel administrativo.</p>
        <Button variant="outline" onClick={() => signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    );
  }

  return <AdminDashboard onSignOut={signOut} />;
}

function AdminDashboard({ onSignOut }: { onSignOut: () => void }) {
  const { data: stores = [], isLoading } = useStores();
  const createStore = useCreateStore();
  const updateStore = useUpdateStore();
  const deleteStore = useDeleteStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreType | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    type: 'LOJA' as StoreTypeEnum,
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    licenseExpiresAt: '',
  });

  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminStoreId, setAdminStoreId] = useState('');
  const [adminStoreName, setAdminStoreName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const handleOpenAdminDialog = (store: StoreType) => {
    setAdminStoreId(store.id);
    setAdminStoreName(store.name);
    setAdminEmail('');
    setAdminPassword('');
    setAdminDialogOpen(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminEmail || !adminPassword) {
      toast.error('Preencha email e senha');
      return;
    }
    if (adminPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setAdminLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-store-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ email: adminEmail, password: adminPassword, store_id: adminStoreId }),
        }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao criar admin');
      toast.success(result.message || `Admin criado para ${adminStoreName}!`);
      setAdminDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar admin');
    }
    setAdminLoading(false);
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (store?: StoreType) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name,
        slug: store.slug,
        type: store.type,
        address: store.address,
        phone: store.phone,
        whatsapp: store.whatsapp,
        email: store.email,
        licenseExpiresAt: store.licenseExpiresAt || '',
      });
    } else {
      setEditingStore(null);
      setFormData({ name: '', slug: '', type: 'LOJA', address: '', phone: '', whatsapp: '', email: '', licenseExpiresAt: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSaveStore = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      if (editingStore) {
        await updateStore.mutateAsync({ id: editingStore.id, ...formData });
        toast.success('Empresa atualizada com sucesso!');
      } else {
        const template = getTemplateForType(formData.type);
        const mergedSettings = template
          ? { ...defaultSettings, ...template.settings }
          : defaultSettings;
        const created = await createStore.mutateAsync({
          ...formData,
          isActive: true,
          settings: mergedSettings,
          licenseExpiresAt: formData.licenseExpiresAt || null,
        });

        // Aplicar dados estruturais do template (categorias + ingredientes)
        if (template && created?.id) {
          const storeId = created.id;
          try {
            if (template.categories.length > 0) {
              const catRows = template.categories.map((name, idx) => ({
                store_id: storeId,
                name,
                sort_order: idx,
              }));
              await supabase.from('categories').insert(catRows);
            }
            if (template.ingredients.length > 0) {
              const ingRows = template.ingredients.map((ing, idx) => ({
                store_id: storeId,
                name: ing.name,
                extra_price: ing.extraPrice ?? 0,
                sort_order: idx,
              }));
              await supabase.from('ingredients').insert(ingRows);
            }
            toast.success(
              `Empresa criada com modelo Delivery — ${template.categories.length} categorias e ${template.ingredients.length} ingredientes pré-configurados!`
            );
          } catch (tplErr: any) {
            console.error('[template] erro ao aplicar dados:', tplErr);
            toast.success('Empresa criada! (Falha ao aplicar template — configure manualmente)');
          }
        } else {
          toast.success('Empresa criada com sucesso!');
        }
      }
      setIsDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    }
  };

  const handleToggleActive = async (store: StoreType) => {
    await updateStore.mutateAsync({ id: store.id, isActive: !store.isActive });
    toast.success('Status atualizado!');
  };

  const handleDelete = async (storeId: string) => {
    if (confirm('Tem certeza que deseja excluir esta empresa?')) {
      await deleteStore.mutateAsync(storeId);
      toast.success('Empresa excluída!');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">MeuPedidoNoZap</h1>
              <p className="text-primary-foreground/80">Painel Administrativo</p>
            </div>
            <div className="flex items-center gap-4">
              <RefreshButton
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
              />
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <span className="text-sm">Admin</span>
              </div>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:text-primary-foreground/80" onClick={onSignOut}>
                <LogOut className="h-4 w-4 mr-1" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Empresas Cadastradas</h2>
            <p className="text-muted-foreground">Gerencie as lojas da plataforma</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingStore ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome da Empresa *</Label>
                  <Input id="name" value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="DiColore Profissional" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="slug">URL (slug) *</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/</span>
                    <Input id="slug" value={formData.slug} onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s/g, '-') }))} placeholder="dicolore" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Tipo de Loja *</Label>
                  <Select value={formData.type} onValueChange={(value: StoreTypeEnum) => setFormData(prev => ({ ...prev, type: value }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOJA">Loja de Produtos</SelectItem>
                      <SelectItem value="ACESSORIOS">Acessórios</SelectItem>
                      <SelectItem value="COMIDA">Delivery de Comida</SelectItem>
                      <SelectItem value="SERVICOS">Serviços</SelectItem>
                      <SelectItem value="PIZZARIA">Pizzaria</SelectItem>
                      <SelectItem value="SALAO">Salão de Beleza</SelectItem>
                    </SelectContent>
                  </Select>
                  {!editingStore && formData.type === 'COMIDA' && (
                    <div className="rounded-md border border-accent/30 bg-accent/10 p-3 text-xs text-foreground">
                      ✓ <strong>Modelo Pastelaria/Delivery</strong> será aplicado:
                      horários 08:00–22:00, formas de pagamento (Pix, Cartão, Dinheiro),
                      8 categorias-base e 26 ingredientes comuns (calabresa, mussarela, frango, bebidas etc.).
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input id="address" value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} placeholder="Rua das Flores, 123 - Centro" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="(11) 3456-7890" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" value={formData.whatsapp} onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))} placeholder="5511999999999" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="contato@empresa.com.br" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="license">Licença válida até</Label>
                  <Input id="license" type="date" value={formData.licenseExpiresAt} onChange={e => setFormData(prev => ({ ...prev, licenseExpiresAt: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">Após esta data, a loja será inativada automaticamente. Deixe em branco para não controlar.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSaveStore}>{editingStore ? 'Salvar' : 'Criar Empresa'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar empresa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStores.map(store => (
              <Card key={store.id} className="animate-fade-in overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{store.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">/{store.slug}</p>
                      </div>
                    </div>
                    <button onClick={() => handleToggleActive(store)} className="text-muted-foreground hover:text-foreground">
                      {store.isActive ? <ToggleRight className="h-6 w-6 text-accent" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-2">
                    <Badge className={storeTypeBadgeColors[store.type]}>{storeTypeLabels[store.type]}</Badge>
                    <Badge variant={store.isActive ? 'default' : 'secondary'}>{store.isActive ? 'Ativa' : 'Inativa'}</Badge>
                  </div>
                  {(() => {
                    const ls = getLicenseStatus(store.licenseExpiresAt);
                    const cls = ls.level === 'expired'
                      ? 'bg-red-100 text-red-700'
                      : ls.level === 'warning'
                      ? 'bg-yellow-100 text-yellow-700'
                      : ls.level === 'ok'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-muted text-muted-foreground';
                    const label = ls.level === 'none'
                      ? 'Sem vencimento'
                      : ls.level === 'expired'
                      ? `Licença vencida em ${ls.formatted}`
                      : `Licença até ${ls.formatted} (${ls.daysLeft}d)`;
                    return <div className="mb-3"><Badge className={cls}>{label}</Badge></div>;
                  })()}
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{store.address}</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleOpenDialog(store)}>
                      <Edit2 className="h-3 w-3" /> Editar
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                      <Link to={`/${store.slug}/admin`}><Settings className="h-3 w-3" /> Admin</Link>
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 gap-1" asChild>
                      <Link to={`/${store.slug}`}><Eye className="h-3 w-3" /> Ver</Link>
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => handleOpenAdminDialog(store)}>
                      <UserPlus className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(store.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredStores.length === 0 && (
          <div className="py-12 text-center">
            <Store className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma empresa encontrada</h3>
            <p className="text-muted-foreground">{searchTerm ? 'Tente buscar por outro termo' : 'Crie sua primeira empresa'}</p>
          </div>
        )}

        <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cadastrar Admin - {adminStoreName}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="admin-email">Email do Admin</Label>
                <Input id="admin-email" type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@loja.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input id="admin-password" type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdminDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateAdmin} disabled={adminLoading}>
                {adminLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Criar Admin
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
