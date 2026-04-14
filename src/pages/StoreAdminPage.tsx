import { useState, useRef, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Settings, Tags, Percent,
  ArrowLeft, Plus, Edit2, Trash2, Eye, Printer, CheckCircle, Clock,
  Truck, XCircle, ToggleLeft, ToggleRight, Loader2, Upload, LogOut,
  CalendarIcon, ClipboardList, Users, Layers, BarChart3, RefreshCw,
} from 'lucide-react';
import { useStoreBySlug, useUpdateStore } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useCategories';
import { useProducts, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useFoodItems } from '@/hooks/useFoodItems';
import { useOrders, useUpdateOrderStatus, useUpdateOrder } from '@/hooks/useOrders';
import { useCoupons } from '@/hooks/useCoupons';
import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import { useAuth } from '@/hooks/useAuth';
import { useServiceOrders, useCreateServiceOrder, useDeleteServiceOrder } from '@/hooks/useServiceOrders';
import { useStoreCustomerProfiles, useUpdateCustomerProfileAdmin, useCreateCustomerProfileAdmin, useToggleCustomerActive, useDeleteCustomerProfile, checkCustomerHasOrders } from '@/hooks/useCustomerProfiles';
import { useStoreVisits } from '@/hooks/useStoreVisits';
import { useAllStoreSellers, useCreateStoreSeller, useUpdateStoreSeller, useDeleteStoreSeller } from '@/hooks/useStoreSellers';
import { VisitsBarChart, VisitsHourChart } from '@/components/VisitsCharts';
import { fetchAddressByCep } from '@/lib/cepLookup';
import type { OrderStatus, Product, ServiceOrder, ServiceOrderStatus, StoreType, DiscountRule, ShippingSettings } from '@/types';
import ProductFormDialog from '@/components/ProductFormDialog';
import ImportProductsDialog from '@/components/ImportProductsDialog';
import StoreAdminLogin from '@/components/StoreAdminLogin';
import ServiceOrderDialog from '@/components/ServiceOrderDialog';
import NewOrderDialog from '@/components/NewOrderDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDateTime } from '@/lib/formatters';
import { printOrder } from '@/lib/printOrder';
import { uploadProductImage, recompressExistingImage } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-4 w-4" /> },
  confirmado: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700', icon: <CheckCircle className="h-4 w-4" /> },
  preparando: { label: 'Preparando', color: 'bg-orange-100 text-orange-700', icon: <Package className="h-4 w-4" /> },
  enviado: { label: 'Enviado', color: 'bg-purple-100 text-purple-700', icon: <Truck className="h-4 w-4" /> },
  entregue: { label: 'Entregue', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-4 w-4" /> },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-4 w-4" /> },
};

function StoreAdminAccessDenied({ email, slug }: { email: string; slug: string }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <LogOut className="h-16 w-16 text-destructive" />
      <h1 className="text-2xl font-bold">Acesso negado</h1>
      <p className="text-muted-foreground">Você não tem permissão para administrar esta loja.</p>
      {email && <p className="text-sm text-muted-foreground">Logado como <strong>{email}</strong></p>}
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sair e entrar com outra conta
        </Button>
        <Button asChild><Link to={`/${slug}`}>Ir para a Loja</Link></Button>
      </div>
    </div>
  );
}


export default function StoreAdminPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { user, isAdmin, loading: adminLoading } = useStoreAdmin(store?.id);
  const updateStore = useUpdateStore();
  const { data: categories = [] } = useCategories(store?.id);
  const { data: products = [] } = useProducts(store?.id);
  const { data: foodItems = [] } = useFoodItems(store?.id);
  const { data: orders = [] } = useOrders(isAdmin ? store?.id : undefined);
  const { data: coupons = [] } = useCoupons(isAdmin ? store?.id : undefined);
  const { data: serviceOrders = [] } = useServiceOrders(isAdmin && store?.type === 'SERVICOS' ? store?.id : undefined);
  const { data: customerProfiles = [] } = useStoreCustomerProfiles(isAdmin ? store?.id : undefined);
  const createServiceOrder = useCreateServiceOrder();
  const deleteServiceOrder = useDeleteServiceOrder();
  const updateCustomerProfile = useUpdateCustomerProfileAdmin();
  const createCustomerProfile = useCreateCustomerProfileAdmin();
  const toggleCustomerActive = useToggleCustomerActive();
  const deleteCustomerProfile = useDeleteCustomerProfile();

  // Sellers (Dicolore)
  const { data: sellers = [] } = useAllStoreSellers(isAdmin && store?.slug === 'dicolore' ? store?.id : undefined);
  const createSeller = useCreateStoreSeller();
  const updateSeller = useUpdateStoreSeller();
  const deleteSeller = useDeleteStoreSeller();

  // Visits analytics state
  const [visitsStartDate, setVisitsStartDate] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d;
  });
  const [visitsEndDate, setVisitsEndDate] = useState<Date | undefined>(new Date());
  const { total: visitsTotal, byDay: visitsByDay, byHour: visitsByHour, isLoading: visitsLoading } = useStoreVisits(isAdmin ? store?.id : undefined, visitsStartDate, visitsEndDate);

  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const updateOrderStatus = useUpdateOrderStatus();
  const updateOrder = useUpdateOrder();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedSOId, setSelectedSOId] = useState<string | null>(null);
  const [soDialogOpen, setSODialogOpen] = useState(false);
  const selectedSO = useMemo(() => selectedSOId ? serviceOrders.find(s => s.id === selectedSOId) || null : null, [selectedSOId, serviceOrders]);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', whatsapp: '', address: '', number: '', city: '', uf: '', cep: '', neighborhood: '', complement: '' });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Discount rules state
  const [discountRules, setDiscountRulesLocal] = useState<DiscountRule[]>([]);
  const [discountRulesInitialized, setDiscountRulesInitialized] = useState(false);
  const [newRule, setNewRule] = useState({ groupId: '', minQuantity: '', discountPercent: '', description: '' });
  const [savingRules, setSavingRules] = useState(false);

  // Settings state
  const [settingsName, setSettingsName] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsWhatsapp, setSettingsWhatsapp] = useState('');
  const [settingsLogo, setSettingsLogo] = useState('');
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Sellers state (Dicolore)
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerWhatsapp, setNewSellerWhatsapp] = useState('');

  // Image optimization state
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [optimizeTotal, setOptimizeTotal] = useState(0);
  // Shipping settings state
  const [shippingEnabled, setShippingEnabled] = useState(false);
  const [shippingOriginCep, setShippingOriginCep] = useState('');
  const [shippingWeight, setShippingWeight] = useState('0.5');
  const [shippingLength, setShippingLength] = useState('20');
  const [shippingWidth, setShippingWidth] = useState('15');
  const [shippingHeight, setShippingHeight] = useState('10');
  const [shippingInitialized, setShippingInitialized] = useState(false);

  const allProducts = store?.type === 'COMIDA' ? foodItems : products;

  // Initialize settings from store
  if (store && !settingsInitialized) {
    setSettingsName(store.name);
    setSettingsAddress(store.address);
    setSettingsPhone(store.phone);
    setSettingsWhatsapp(store.whatsapp);
    setSettingsLogo(store.logo);
    setSettingsInitialized(true);
  }

  if (store && !discountRulesInitialized) {
    setDiscountRulesLocal((store.settings.discountRules || []).filter((r: DiscountRule) => r.type === 'group'));
    setDiscountRulesInitialized(true);
  }

  if (store && !shippingInitialized) {
    const s = store.settings.shipping;
    if (s) {
      setShippingEnabled(s.enabled);
      setShippingOriginCep(s.originCep || '');
      setShippingWeight(String(s.defaultWeight || 0.5));
      setShippingLength(String(s.defaultLength || 20));
      setShippingWidth(String(s.defaultWidth || 15));
      setShippingHeight(String(s.defaultHeight || 10));
    }
    setShippingInitialized(true);
  }

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const d = new Date(o.createdAt);
      if (startDate && d < startOfDay(startDate)) return false;
      if (endDate && d > endOfDay(endDate)) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  const stats = useMemo(() => {
    const isServicos = store?.type === 'SERVICOS';

    // For SERVICOS stores, revenue comes ONLY from OS with status 'pago' (orders are mirrors)
    // For other store types, revenue comes from orders with status 'entregue'
    let revenue = 0;

    if (isServicos) {
      revenue = serviceOrders
        .filter(so => so.status === 'pago' && so.paidAt)
        .filter(so => {
          const d = new Date(so.paidAt!);
          if (startDate && d < startOfDay(startDate)) return false;
          if (endDate && d > endOfDay(endDate)) return false;
          return true;
        })
        .reduce((sum, so) => sum + so.total, 0);
    } else {
      revenue = filteredOrders.filter(o => o.status === 'entregue').reduce((sum, o) => sum + o.total, 0);
    }

    return {
      totalProducts: allProducts.length,
      totalOrders: filteredOrders.length,
      pendingOrders: filteredOrders.filter(o => o.status === 'pendente').length,
      revenue,
    };
  }, [allProducts, filteredOrders, serviceOrders, startDate, endDate, store?.type]);

  if (storeLoading || adminLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4"><Link to="/admin">Voltar ao Admin</Link></Button>
        </div>
      </div>
    );
  }

  // Auth gate
  if (!user) return <StoreAdminLogin storeName={store.name} />;
  if (!isAdmin) {
    return <StoreAdminAccessDenied email={user.email ?? ''} slug={slug!} />;
  }

  const handleToggleProductActive = async (product: Product) => {
    await updateProduct.mutateAsync({ id: product.id, isActive: !product.isActive });
    toast.success('Status atualizado!');
  };

  const handleDeleteProduct = async (productId: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      await deleteProduct.mutateAsync(productId);
      toast.success('Produto excluído!');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleNewProduct = () => {
    setEditingProduct(null);
    setProductDialogOpen(true);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({ storeId: store.id, name: newCategoryName });
    setNewCategoryName('');
    toast.success('Categoria criada!');
  };

  const handleDeleteCategory = async (id: string) => {
    if (confirm('Excluir categoria?')) {
      await deleteCategory.mutateAsync(id);
      toast.success('Categoria excluída!');
    }
  };

  const handleEditCategory = (id: string, name: string) => {
    setEditingCategoryId(id);
    setEditingCategoryName(name);
  };

  const handleSaveCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    await updateCategory.mutateAsync({ id: editingCategoryId, name: editingCategoryName.trim() });
    setEditingCategoryId(null);
    setEditingCategoryName('');
    toast.success('Categoria atualizada!');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadProductImage(file, store.id);
      setSettingsLogo(url);
      toast.success('Logo enviada!');
    } catch {
      toast.error('Erro ao enviar logo');
    }
    setLogoUploading(false);
  };

  const handleSaveSettings = async () => {
    try {
      const shippingData: ShippingSettings | undefined = (store.type === 'LOJA' || store.type === 'ACESSORIOS')
        ? {
            enabled: shippingEnabled,
            originCep: shippingOriginCep.replace(/\D/g, ''),
            defaultWeight: parseFloat(shippingWeight) || 0.5,
            defaultLength: parseFloat(shippingLength) || 20,
            defaultWidth: parseFloat(shippingWidth) || 15,
            defaultHeight: parseFloat(shippingHeight) || 10,
          }
        : store.settings.shipping;

      await updateStore.mutateAsync({
        id: store.id,
        name: settingsName,
        address: settingsAddress,
        phone: settingsPhone,
        whatsapp: settingsWhatsapp,
        logo: settingsLogo,
        settings: { ...store.settings, shipping: shippingData },
      });
      toast.success('Configurações salvas!');
    } catch {
      toast.error('Erro ao salvar');
    }
  };

  const handleOptimizeImages = async () => {
    if (optimizing) return;
    setOptimizing(true);
    setOptimizeProgress(0);

    try {
      const imageUrls: string[] = [];

      // Get product IDs and main images
      const { data: prods } = await supabase
        .from('products')
        .select('id, image_url')
        .eq('store_id', store.id);

      const productIds = (prods || []).map(p => p.id);
      for (const p of prods || []) {
        if (p.image_url) imageUrls.push(p.image_url);
      }

      // Get additional product images
      if (productIds.length > 0) {
        const { data: prodImages } = await supabase
          .from('product_images')
          .select('image_url')
          .in('product_id', productIds);

        for (const pi of prodImages || []) {
          if (pi.image_url) imageUrls.push(pi.image_url);
        }
      }

      // Deduplicate
      const unique = [...new Set(imageUrls)];
      setOptimizeTotal(unique.length);

      if (unique.length === 0) {
        toast.info('Nenhuma imagem encontrada para otimizar');
        setOptimizing(false);
        return;
      }

      let optimized = 0;
      for (let i = 0; i < unique.length; i++) {
        const result = await recompressExistingImage(unique[i]);
        if (result) optimized++;
        setOptimizeProgress(i + 1);
      }

      toast.success(`${optimized} de ${unique.length} imagens otimizadas!`);
    } catch (err: any) {
      console.error('Erro ao otimizar:', err);
      toast.error('Erro ao otimizar imagens');
    }

    setOptimizing(false);
  };

  const handleAddDiscountRule = () => {
    if (!newRule.groupId.trim() || !newRule.minQuantity || !newRule.discountPercent) {
      toast.error('Preencha todos os campos da regra');
      return;
    }
    const rule: DiscountRule = {
      id: crypto.randomUUID(),
      type: 'group',
      groupId: newRule.groupId.trim(),
      minQuantity: Number(newRule.minQuantity),
      discountPercent: Number(newRule.discountPercent),
      description: newRule.description || `${newRule.minQuantity}+ peças → ${newRule.discountPercent}% off`,
    };
    setDiscountRulesLocal(prev => [...prev, rule]);
    setNewRule({ groupId: '', minQuantity: '', discountPercent: '', description: '' });
  };

  const handleRemoveDiscountRule = (id: string) => {
    setDiscountRulesLocal(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveDiscountRules = async () => {
    setSavingRules(true);
    try {
      const allRules = [
        ...(store.settings.discountRules || []).filter((r: DiscountRule) => r.type !== 'group'),
        ...discountRules,
      ];
      await updateStore.mutateAsync({
        id: store.id,
        settings: { ...store.settings, discountRules: allRules },
      });
      toast.success('Regras de desconto salvas!');
    } catch (err: any) {
      console.error('Erro ao salvar regras:', err);
      toast.error(err?.message || 'Erro ao salvar regras');
    }
    setSavingRules(false);
  };

  const revenueLabel = (startDate || endDate) ? 'Faturamento do Período' : 'Faturamento Total';

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div>
                <h1 className="text-xl font-bold">{store.name}</h1>
                <p className="text-sm text-primary-foreground/80">Painel da Loja</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                <Link to={`/${store.slug}`}><Eye className="mr-2 h-4 w-4" /> Ver Loja</Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:text-primary-foreground/80" onClick={() => { supabase.auth.signOut(); }}>
                <LogOut className="h-4 w-4 mr-1" /> Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
            <TabsTrigger value="categories" className="gap-2"><Tags className="h-4 w-4" /> Categorias</TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <ShoppingCart className="h-4 w-4" /> Pedidos
              {stats.pendingOrders > 0 && <Badge className="ml-1 bg-destructive text-destructive-foreground">{stats.pendingOrders}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2"><Percent className="h-4 w-4" /> Cupons</TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2"><Layers className="h-4 w-4" /> Descontos</TabsTrigger>
            {store.type === 'SERVICOS' && (
              <TabsTrigger value="service-orders" className="gap-2"><ClipboardList className="h-4 w-4" /> Ordens de Serviço</TabsTrigger>
            )}
            <TabsTrigger value="customers" className="gap-2"><Users className="h-4 w-4" /> Clientes</TabsTrigger>
            <TabsTrigger value="visits" className="gap-2"><BarChart3 className="h-4 w-4" /> Visitas</TabsTrigger>
            <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="animate-fade-in">
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Período:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !startDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => endDate ? date > endDate : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[160px] justify-start text-left font-normal", !endDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : "Data Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              {(startDate || endDate) && (
                <Button variant="ghost" size="sm" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>
                  Limpar
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Produtos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.totalProducts}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{stats.totalOrders}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pedidos Pendentes</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-warning">{stats.pendingOrders}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{revenueLabel}</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold text-accent">{formatCurrency(stats.revenue)}</div></CardContent></Card>
            </div>
            <Card className="mt-6">
              <CardHeader><CardTitle>Pedidos Recentes</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredOrders.slice(0, 10).map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                        <TableCell>{order.customer.name}</TableCell>
                         <TableCell>
                            <div className="space-y-0.5">
                              {order.items.map((item: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{item.quantity}x</span> {item.name}
                                  {(item.size || item.color) && (
                                    <span className="ml-1 opacity-70">— {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        <TableCell>{formatCurrency(order.total)}</TableCell>
                        <TableCell><Badge className={statusConfig[order.status].color}>{statusConfig[order.status].label}</Badge></TableCell>
                        <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products */}
          <TabsContent value="products" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Produtos</h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="gap-2" onClick={handleSyncPrices} disabled={syncingPrices}>
                  {syncingPrices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar Preços
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4" /> Importar Excel
                </Button>
                <Button className="gap-2" onClick={handleNewProduct}><Plus className="h-4 w-4" /> Novo Produto</Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Imagem</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map(product => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-10 w-10 rounded object-contain bg-white" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs text-muted-foreground">Sem</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.code || '-'}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{product.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>{categories.find(c => c.id === product.categoryId)?.name || '-'}</TableCell>
                        <TableCell>{formatCurrency(product.basePrice)}</TableCell>
                        <TableCell>
                          <button onClick={() => handleToggleProductActive(product)}>
                            {product.isActive ? <ToggleRight className="h-6 w-6 text-accent" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product)}><Edit2 className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteProduct(product.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {products.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum produto cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Categorias</h3>
              <div className="flex gap-2">
                <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nome da categoria" className="w-48" />
                <Button className="gap-2" onClick={handleAddCategory}><Plus className="h-4 w-4" /> Adicionar</Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(category => (
                <Card key={category.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    {editingCategoryId === category.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingCategoryName}
                          onChange={e => setEditingCategoryName(e.target.value)}
                          className="flex-1"
                          onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
                          autoFocus
                        />
                        <Button size="sm" onClick={handleSaveCategory}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {products.filter(p => p.categoryId === category.id).length} produtos
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditCategory(category.id, category.name)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteCategory(category.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Pedidos</h3>
              <Button variant="outline" onClick={() => setNewOrderDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Novo Pedido
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{order.customer.name}</p>
                          <p className="text-xs text-muted-foreground">{order.customer.whatsapp}</p>
                        </TableCell>
                         <TableCell>
                            <div className="space-y-0.5 min-w-[180px]">
                              {order.items.map((item: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{item.quantity}x</span> {item.name}
                                  {(item.size || item.color) && (
                                    <span className="ml-1 opacity-70">— {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        <TableCell className="font-medium">{formatCurrency(order.total)}</TableCell>
                        <TableCell className="uppercase text-xs">{order.paymentMethod}</TableCell>
                        <TableCell>
                          {store.type === 'SERVICOS' ? (
                            <div className="flex items-center gap-1">
                              <Badge className={statusConfig[order.status]?.color}>
                                {statusConfig[order.status]?.icon}
                                <span className="ml-1">{statusConfig[order.status]?.label}</span>
                              </Badge>
                              {(() => {
                                const hasSO = serviceOrders.some(so => so.orderId === order.id);
                                if (!hasSO && order.status !== 'cancelado') {
                                  return (
                                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={async () => {
                                      await updateOrderStatus.mutateAsync({ id: order.id, status: 'cancelado' });
                                      toast.success('Pedido cancelado!');
                                    }}>
                                      <XCircle className="h-3 w-3 mr-1" /> Cancelar
                                    </Button>
                                  );
                                }
                                if (hasSO && order.status !== 'cancelado') {
                                  return (
                                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={async () => {
                                      const so = serviceOrders.find(s => s.orderId === order.id);
                                      if (so) {
                                        await deleteServiceOrder.mutateAsync({ id: so.id, storeId: store.id });
                                      }
                                      await updateOrderStatus.mutateAsync({ id: order.id, status: 'cancelado' });
                                      toast.success('OS excluída e pedido cancelado!');
                                    }}>
                                      <XCircle className="h-3 w-3 mr-1" /> Cancelar
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            <Select value={order.status} onValueChange={(value) => {
                              updateOrderStatus.mutateAsync({ id: order.id, status: value as OrderStatus });
                              toast.success('Status atualizado!');
                            }}>
                              <SelectTrigger className="w-32">
                                <Badge className={statusConfig[order.status]?.color}>
                                  {statusConfig[order.status]?.icon}
                                  <span className="ml-1">{statusConfig[order.status]?.label}</span>
                                </Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(statusConfig).map(([key, cfg]) => (
                                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {store.type === 'SERVICOS' && (() => {
                              const existingSO = serviceOrders.find(so => so.orderId === order.id);
                              if (existingSO) {
                                return (
                                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                                    setSelectedSOId(existingSO.id);
                                    setSODialogOpen(true);
                                  }}>
                                    <ClipboardList className="h-3 w-3" /> Abrir OS
                                  </Button>
                                );
                              }
                              return (
                                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={async () => {
                                  try {
                                    const so = await createServiceOrder.mutateAsync({
                                      storeId: store.id,
                                      orderId: order.id,
                                      orderNumber: order.orderNumber,
                                      customer: order.customer,
                                      items: order.items,
                                      subtotal: order.subtotal,
                                      discount: order.discount,
                                      total: order.total,
                                      userId: (order as any).userId || undefined,
                                    });
                                    setSelectedSOId(so.id);
                                    setSODialogOpen(true);
                                    await updateOrderStatus.mutateAsync({ id: order.id, status: 'confirmado' });
                                    toast.success('OS gerada!');
                                  } catch { toast.error('Erro ao gerar OS'); }
                                }}>
                                  <ClipboardList className="h-3 w-3" /> Gerar OS
                                </Button>
                              );
                            })()}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Printer className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  const so = serviceOrders.find(s => s.orderId === order.id);
                                  printOrder(order, store.name, 'thermal', { extraItems: so?.extraItems });
                                }}>
                                  Impressora Térmica (80mm)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const so = serviceOrders.find(s => s.orderId === order.id);
                                  printOrder(order, store.name, 'a4', { extraItems: so?.extraItems });
                                }}>
                                  Folha A4
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Coupons */}
          <TabsContent value="coupons" className="animate-fade-in">
            <div className="mb-4"><h3 className="text-lg font-semibold">Cupons de Desconto</h3></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {coupons.map(coupon => (
                <Card key={coupon.id}>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant="outline" className="font-mono text-lg">{coupon.code}</Badge>
                      <Badge variant={coupon.isActive ? 'default' : 'secondary'}>{coupon.isActive ? 'Ativo' : 'Inativo'}</Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Desconto:</span> <span className="font-medium">{coupon.discountPercent ? `${coupon.discountPercent}%` : formatCurrency(coupon.discountValue || 0)}</span></p>
                      <p><span className="text-muted-foreground">Mínimo:</span> {formatCurrency(coupon.minOrderValue)}</p>
                      <p><span className="text-muted-foreground">Usos:</span> {coupon.usedCount}/{coupon.maxUses}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Discounts by group */}
          <TabsContent value="discounts" className="animate-fade-in">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nova Regra de Desconto por Grupo</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Defina faixas de desconto por quantidade de peças do mesmo grupo. O <strong>ID do Grupo</strong> deve coincidir com o campo "Grupo" preenchido nos produtos.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="grid gap-1">
                      <Label className="text-sm">ID do Grupo *</Label>
                      <Input
                        placeholder="ex: GRUPO-A"
                        value={newRule.groupId}
                        onChange={e => setNewRule(r => ({ ...r, groupId: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm">Qtd. Mínima *</Label>
                      <Input
                        type="number" min="1" placeholder="ex: 6"
                        value={newRule.minQuantity}
                        onChange={e => setNewRule(r => ({ ...r, minQuantity: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm">% de Desconto *</Label>
                      <Input
                        type="number" min="1" max="100" placeholder="ex: 10"
                        value={newRule.discountPercent}
                        onChange={e => setNewRule(r => ({ ...r, discountPercent: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm">Descrição</Label>
                      <Input
                        placeholder="ex: 6 peças = 10% off"
                        value={newRule.description}
                        onChange={e => setNewRule(r => ({ ...r, description: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button className="mt-4 gap-2" onClick={handleAddDiscountRule}>
                    <Plus className="h-4 w-4" /> Adicionar Regra
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle>Regras Cadastradas</CardTitle>
                  <Button onClick={handleSaveDiscountRules} disabled={savingRules} size="sm" className="gap-2">
                    {savingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar Regras
                  </Button>
                </CardHeader>
                <CardContent>
                  {discountRules.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground text-sm">Nenhuma regra cadastrada. Adicione faixas de desconto acima.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Qtd. Mínima</TableHead>
                          <TableHead>Desconto</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {discountRules
                          .sort((a, b) => (a.groupId || '').localeCompare(b.groupId || '') || (a.minQuantity || 0) - (b.minQuantity || 0))
                          .map(rule => (
                          <TableRow key={rule.id}>
                            <TableCell><Badge variant="outline" className="font-mono">{rule.groupId}</Badge></TableCell>
                            <TableCell>{rule.minQuantity}+ peças</TableCell>
                            <TableCell><Badge className="bg-accent text-accent-foreground">{rule.discountPercent}% OFF</Badge></TableCell>
                            <TableCell className="text-muted-foreground text-sm">{rule.description}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveDiscountRule(rule.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Visitas */}
          <TabsContent value="visits" className="animate-fade-in">
            <div className="space-y-6">
              {/* Total + date filter */}
              <div className="flex flex-wrap items-center gap-4">
                <Card className="flex-1 min-w-[200px]">
                  <CardContent className="p-4 flex items-center gap-4">
                    <BarChart3 className="h-10 w-10 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Visitas</p>
                      <p className="text-3xl font-bold">{visitsTotal.toLocaleString('pt-BR')}</p>
                    </div>
                  </CardContent>
                </Card>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground font-medium">Período:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !visitsStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {visitsStartDate ? format(visitsStartDate, "dd/MM/yyyy", { locale: ptBR }) : "Início"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={visitsStartDate} onSelect={setVisitsStartDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("w-[150px] justify-start text-left font-normal", !visitsEndDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {visitsEndDate ? format(visitsEndDate, "dd/MM/yyyy", { locale: ptBR }) : "Fim"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={visitsEndDate} onSelect={setVisitsEndDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {visitsLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {/* Bar chart - visits per day */}
                  <Card>
                    <CardHeader><CardTitle>Visitas por Dia</CardTitle></CardHeader>
                    <CardContent>
                      {visitsByDay.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">Nenhuma visita no período selecionado.</p>
                      ) : (
                        <div className="h-[300px] w-full">
                          <VisitsBarChart data={visitsByDay} />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Hourly breakdown */}
                  <Card>
                    <CardHeader><CardTitle>Visitas por Hora do Dia</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[250px] w-full">
                        <VisitsHourChart data={visitsByHour} />
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="animate-fade-in">
            <Card>
              <CardHeader><CardTitle>Informações da Loja</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                {/* Logo upload */}
                <div className="grid gap-2">
                  <Label>Logo da Empresa</Label>
                  <div className="flex items-center gap-4">
                    {settingsLogo ? (
                      <img src={settingsLogo} alt="Logo" className="h-20 w-20 rounded-lg object-cover border" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed bg-muted text-muted-foreground text-xs">Sem logo</div>
                    )}
                    <div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        {logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {settingsLogo ? 'Trocar Logo' : 'Enviar Logo'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2"><Label>Nome</Label><Input value={settingsName} onChange={e => setSettingsName(e.target.value)} /></div>
                <div className="grid gap-2"><Label>Endereço</Label><Textarea value={settingsAddress} onChange={e => setSettingsAddress(e.target.value)} /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2"><Label>Telefone</Label><Input value={settingsPhone} onChange={e => setSettingsPhone(e.target.value)} placeholder="(11) 3456-7890" /></div>
                  <div className="grid gap-2"><Label>WhatsApp (receber pedidos)</Label><Input value={settingsWhatsapp} onChange={e => setSettingsWhatsapp(e.target.value)} placeholder="5511999999999" /></div>
                </div>
                <Button onClick={handleSaveSettings} disabled={updateStore.isPending}>
                  {updateStore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Alterações
                </Button>
              </CardContent>
            </Card>

            {/* Shipping config - LOJA and ACESSORIOS only */}
            {(store.type === 'LOJA' || store.type === 'ACESSORIOS') && (
              <Card className="mt-6">
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Frete Correios</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Configure o frete via Correios. O cliente poderá ver a cotação de PAC e SEDEX no checkout.</p>
                  <div className="flex items-center gap-3">
                    <Label>Ativar frete Correios</Label>
                    <button onClick={() => setShippingEnabled(!shippingEnabled)} className="text-muted-foreground hover:text-foreground">
                      {shippingEnabled ? <ToggleRight className="h-6 w-6 text-accent" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </div>
                  {shippingEnabled && (
                    <>
                      <div className="grid gap-2">
                        <Label>CEP de Origem (da loja)</Label>
                        <Input
                          value={shippingOriginCep}
                          onChange={async e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                            const formatted = val.length > 5 ? `${val.slice(0, 5)}-${val.slice(5)}` : val;
                            setShippingOriginCep(formatted);
                            if (val.length === 8) {
                              const result = await fetchAddressByCep(val);
                              if (result) {
                                setSettingsAddress(`${result.address}, ${result.neighborhood} - ${result.city}/${result.uf}`);
                              }
                            }
                          }}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="grid gap-2">
                          <Label className="text-xs">Peso padrão (kg)</Label>
                          <Input type="number" step="0.1" min="0.1" value={shippingWeight} onChange={e => setShippingWeight(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">Comprimento (cm)</Label>
                          <Input type="number" min="16" value={shippingLength} onChange={e => setShippingLength(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">Largura (cm)</Label>
                          <Input type="number" min="11" value={shippingWidth} onChange={e => setShippingWidth(e.target.value)} />
                        </div>
                        <div className="grid gap-2">
                          <Label className="text-xs">Altura (cm)</Label>
                          <Input type="number" min="2" value={shippingHeight} onChange={e => setShippingHeight(e.target.value)} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">Dimensões mínimas dos Correios: 16x11x2 cm, peso mínimo 300g.</p>
                      <Button onClick={handleSaveSettings} disabled={updateStore.isPending} size="sm">
                        {updateStore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar Configurações de Frete
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Otimizar Imagens */}
            <Card className="mt-6">
              <CardHeader><CardTitle>Otimizar Imagens</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Recomprime todas as imagens dos produtos para carregar mais rápido na vitrine. Imagens já otimizadas (menos de 100KB) serão ignoradas.
                </p>
                {optimizing && optimizeTotal > 0 && (
                  <div className="space-y-2">
                    <Progress value={(optimizeProgress / optimizeTotal) * 100} className="h-3" />
                    <p className="text-sm text-muted-foreground text-center">
                      Otimizando {optimizeProgress} de {optimizeTotal}...
                    </p>
                  </div>
                )}
                <Button onClick={handleOptimizeImages} disabled={optimizing} size="sm" variant="outline">
                  {optimizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {optimizing ? 'Otimizando...' : 'Otimizar Imagens'}
                </Button>
              </CardContent>
            </Card>

            {/* Sellers management - Dicolore only */}
            {store.slug === 'dicolore' && (
              <Card className="mt-6">
                <CardHeader><CardTitle>Vendedores (WhatsApp)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">Cadastre os vendedores que podem receber pedidos via WhatsApp. O cliente escolherá para quem enviar no checkout.</p>
                  
                  {/* Add new seller */}
                  <div className="flex gap-2 items-end">
                    <div className="grid gap-1 flex-1">
                      <Label className="text-xs">Nome</Label>
                      <Input value={newSellerName} onChange={e => setNewSellerName(e.target.value)} placeholder="Nome do vendedor" />
                    </div>
                    <div className="grid gap-1 flex-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input value={newSellerWhatsapp} onChange={e => setNewSellerWhatsapp(e.target.value)} placeholder="5547999999999" />
                    </div>
                    <Button size="sm" disabled={!newSellerName.trim() || !newSellerWhatsapp.trim() || createSeller.isPending} onClick={async () => {
                      await createSeller.mutateAsync({ store_id: store.id, name: newSellerName.trim(), whatsapp: newSellerWhatsapp.trim() });
                      setNewSellerName(''); setNewSellerWhatsapp('');
                      toast.success('Vendedor cadastrado!');
                    }}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>

                  {/* Sellers list */}
                  {sellers.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellers.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.whatsapp}</TableCell>
                            <TableCell>
                              <Badge className={s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {s.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => {
                                updateSeller.mutate({ id: s.id, is_active: !s.is_active });
                                toast.success(s.is_active ? 'Vendedor desativado' : 'Vendedor ativado');
                              }}>
                                {s.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm(`Remover vendedor ${s.name}?`)) {
                                  deleteSeller.mutate({ id: s.id, storeId: store.id });
                                  toast.success('Vendedor removido');
                                }
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  {sellers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum vendedor cadastrado</p>}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Service Orders - only for SERVICOS */}
          {store.type === 'SERVICOS' && (
            <TabsContent value="service-orders" className="animate-fade-in">
              <div className="mb-4"><h3 className="text-lg font-semibold">Ordens de Serviço</h3></div>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>OS</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead>
                        <TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {serviceOrders.map(so => (
                        <TableRow key={so.id} className="cursor-pointer" onClick={() => { setSelectedSOId(so.id); setSODialogOpen(true); }}>
                          <TableCell className="font-medium">#{so.osNumber}</TableCell>
                          <TableCell>{so.customer.name}</TableCell>
                          <TableCell>{so.items.length + so.extraItems.length} itens</TableCell>
                          <TableCell className="font-medium">{formatCurrency(so.total)}</TableCell>
                          <TableCell>
                            <Badge className={
                              so.status === 'aberta' ? 'bg-yellow-100 text-yellow-700' :
                              so.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' :
                              so.status === 'concluida' ? 'bg-green-100 text-green-700' :
                              so.status === 'pago' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-red-100 text-red-700'
                            }>
                              {so.status === 'aberta' ? 'Aberta' : so.status === 'em_andamento' ? 'Em Andamento' : so.status === 'concluida' ? 'Concluída' : so.status === 'pago' ? 'Pago' : 'Cancelada'}
                            </Badge>
                          </TableCell>
                          <TableCell>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedSOId(so.id); setSODialogOpen(true); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {serviceOrders.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhuma OS encontrada. Gere uma OS a partir de um pedido.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Customers */}
          <TabsContent value="customers" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Clientes Cadastrados</h3>
              <Button size="sm" onClick={() => {
                setCreatingCustomer(true);
                setCustomerForm({ name: '', whatsapp: '', address: '', number: '', city: '', uf: '', cep: '', neighborhood: '', complement: '' });
              }}>
                <Plus className="mr-2 h-4 w-4" /> Novo Cliente
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead><TableHead>WhatsApp</TableHead><TableHead>Cidade/UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerProfiles.map(cp => (
                      <TableRow key={cp.id} className={!(cp as any).isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{cp.name || '—'}</TableCell>
                        <TableCell>{cp.whatsapp || '—'}</TableCell>
                        <TableCell>{cp.city && cp.uf ? `${cp.city}/${cp.uf}` : '—'}</TableCell>
                        <TableCell>
                          <Badge className={(cp as any).isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {(cp as any).isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => {
                            setEditingCustomer(cp);
                            setCustomerForm({
                              name: cp.name, whatsapp: cp.whatsapp, address: cp.address,
                              number: cp.number, city: cp.city, uf: cp.uf, cep: cp.cep,
                              neighborhood: cp.neighborhood, complement: cp.complement || '',
                            });
                          }}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title={(cp as any).isActive ? 'Inativar' : 'Ativar'}
                            onClick={async () => {
                              const newActive = !(cp as any).isActive;
                              await toggleCustomerActive.mutateAsync({ id: cp.id, isActive: newActive, storeId: cp.storeId });
                              toast.success(newActive ? 'Cliente ativado!' : 'Cliente inativado!');
                            }}
                          >
                            {(cp as any).isActive ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Excluir"
                            onClick={async () => {
                              const hasOrders = await checkCustomerHasOrders(cp.name, cp.storeId, cp.userId || undefined);
                              if (hasOrders) {
                                toast.error('Este cliente possui pedidos ou ordens de serviço vinculadas. Você pode inativá-lo em vez de excluir.');
                                return;
                              }
                              if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
                              try {
                                await deleteCustomerProfile.mutateAsync({ id: cp.id, storeId: cp.storeId });
                                toast.success('Cliente excluído!');
                              } catch { toast.error('Erro ao excluir cliente'); }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {customerProfiles.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhum cliente cadastrado ainda</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Edit customer dialog */}
            {editingCustomer && (
              <Dialog open={!!editingCustomer} onOpenChange={(v) => { if (!v) setEditingCustomer(null); }}>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
                  <div className="grid gap-3 py-2">
                    <div className="grid gap-1"><Label className="text-sm">Nome</Label><Input value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} /></div>
                    <div className="grid gap-1"><Label className="text-sm">WhatsApp</Label><Input value={customerForm.whatsapp} onChange={e => setCustomerForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-1"><Label className="text-sm">CEP</Label><Input value={customerForm.cep} onChange={e => setCustomerForm(f => ({ ...f, cep: e.target.value }))} /></div>
                      <div className="grid gap-1"><Label className="text-sm">UF</Label><Input value={customerForm.uf} onChange={e => setCustomerForm(f => ({ ...f, uf: e.target.value }))} /></div>
                    </div>
                    <div className="grid gap-1"><Label className="text-sm">Cidade</Label><Input value={customerForm.city} onChange={e => setCustomerForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div className="grid gap-1"><Label className="text-sm">Bairro</Label><Input value={customerForm.neighborhood} onChange={e => setCustomerForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 grid gap-1"><Label className="text-sm">Endereço</Label><Input value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} /></div>
                      <div className="grid gap-1"><Label className="text-sm">Nº</Label><Input value={customerForm.number} onChange={e => setCustomerForm(f => ({ ...f, number: e.target.value }))} /></div>
                    </div>
                    <div className="grid gap-1"><Label className="text-sm">Complemento</Label><Input value={customerForm.complement} onChange={e => setCustomerForm(f => ({ ...f, complement: e.target.value }))} /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancelar</Button>
                    <Button onClick={async () => {
                      try {
                        await updateCustomerProfile.mutateAsync({ id: editingCustomer.id, storeId: editingCustomer.storeId, ...customerForm });
                        toast.success('Cliente atualizado!');
                        setEditingCustomer(null);
                      } catch { toast.error('Erro ao atualizar'); }
                    }}>Salvar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {/* Create customer dialog */}
            <Dialog open={creatingCustomer} onOpenChange={setCreatingCustomer}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo Cliente</DialogTitle></DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1"><Label className="text-sm">Nome</Label><Input value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div className="grid gap-1"><Label className="text-sm">WhatsApp</Label><Input value={customerForm.whatsapp} onChange={e => setCustomerForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1"><Label className="text-sm">CEP</Label><Input value={customerForm.cep} onChange={e => setCustomerForm(f => ({ ...f, cep: e.target.value }))} /></div>
                    <div className="grid gap-1"><Label className="text-sm">UF</Label><Input value={customerForm.uf} onChange={e => setCustomerForm(f => ({ ...f, uf: e.target.value }))} /></div>
                  </div>
                  <div className="grid gap-1"><Label className="text-sm">Cidade</Label><Input value={customerForm.city} onChange={e => setCustomerForm(f => ({ ...f, city: e.target.value }))} /></div>
                  <div className="grid gap-1"><Label className="text-sm">Bairro</Label><Input value={customerForm.neighborhood} onChange={e => setCustomerForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2 grid gap-1"><Label className="text-sm">Endereço</Label><Input value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} /></div>
                    <div className="grid gap-1"><Label className="text-sm">Nº</Label><Input value={customerForm.number} onChange={e => setCustomerForm(f => ({ ...f, number: e.target.value }))} /></div>
                  </div>
                  <div className="grid gap-1"><Label className="text-sm">Complemento</Label><Input value={customerForm.complement} onChange={e => setCustomerForm(f => ({ ...f, complement: e.target.value }))} /></div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreatingCustomer(false)}>Cancelar</Button>
                  <Button disabled={!customerForm.name.trim() || createCustomerProfile.isPending} onClick={async () => {
                    try {
                      await createCustomerProfile.mutateAsync({ storeId: store.id, ...customerForm });
                      toast.success('Cliente criado!');
                      setCreatingCustomer(false);
                    } catch { toast.error('Erro ao criar cliente'); }
                  }}>
                    {createCustomerProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </main>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        storeId={store.id}
        categories={categories}
        product={editingProduct}
      />
      <ImportProductsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={store.id}
        categories={categories}
        storeType={store.type as StoreType}
      />
      <ServiceOrderDialog
        open={soDialogOpen}
        onOpenChange={setSODialogOpen}
        serviceOrder={selectedSO}
        storeName={store.name}
        storeWhatsapp={store.whatsapp}
        onOrderUpdate={async ({ orderId, status, total, subtotal }) => {
          await updateOrder.mutateAsync({ id: orderId, status: status as OrderStatus, total, subtotal });
        }}
      />
      <NewOrderDialog
        open={newOrderDialogOpen}
        onOpenChange={setNewOrderDialogOpen}
        store={store}
        products={products}
        foodItems={foodItems}
        customerProfiles={customerProfiles}
        categories={categories}
      />
    </div>
  );
}
