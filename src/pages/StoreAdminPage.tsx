import { useState, useRef, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, ShoppingCart, Settings, Tags, Percent,
  ArrowLeft, Plus, Edit2, Trash2, Eye, Printer, Download, CheckCircle, Clock,
  Truck, XCircle, ToggleLeft, ToggleRight, Loader2, Upload, LogOut, Send,
  CalendarIcon, ClipboardList, Users, Layers, BarChart3, RefreshCw, KeyRound, UserCog,
  Scissors, Salad, Pizza, Grid3x3,
  MapPin, Search,
} from 'lucide-react';
import { useStoreBySlug, useUpdateStore } from '@/hooks/useStores';
import { supabase } from '@/integrations/supabase/client';
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useCategories';
import { useProducts, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useFoodItems } from '@/hooks/useFoodItems';
import { useOrders, useUpdateOrderStatus, useUpdateOrder, useDeleteOrder } from '@/hooks/useOrders';
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
import type { MaterialApoioSettings } from '@/types';
import ProductFormDialog from '@/components/ProductFormDialog';
import ImportProductsDialog from '@/components/ImportProductsDialog';
import ImportCustomersDialog from '@/components/ImportCustomersDialog';
import ImportDiscountRulesDialog from '@/components/ImportDiscountRulesDialog';
import StoreAdminLogin from '@/components/StoreAdminLogin';
import ServiceOrderDialog from '@/components/ServiceOrderDialog';
import NewOrderDialog from '@/components/NewOrderDialog';
import EditOrderDialog from '@/components/EditOrderDialog';
import DicolorePaymentCodesTab from '@/components/DicolorePaymentCodesTab';
import StoreUsersTab from '@/components/StoreUsersTab';
import SalonAdminTab from '@/components/SalonAdminTab';
import IngredientsTab from '@/components/IngredientsTab';
import PizzaBordersTab from '@/components/PizzaBordersTab';
import TablesTab from '@/components/TablesTab';
import BusinessHoursTab from '@/components/BusinessHoursTab';
import AtendimentoTab from '@/components/AtendimentoTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { downloadOrderFile } from '@/lib/exportOrder';
import { uploadProductImage, recompressExistingImage } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import RefreshButton from '@/components/RefreshButton';
import { getLicenseStatus } from '@/lib/licenseStatus';
import { buildRenewalLink } from '@/lib/supportContact';
import { AlertTriangle } from 'lucide-react';
import ChangePasswordCard from '@/components/ChangePasswordCard';
import { PushNotificationsCard } from '@/components/PushNotificationsCard';
import OrderErrorsDiagnosticsCard from '@/components/OrderErrorsDiagnosticsCard';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="h-4 w-4" /> },
  liberado_transmissao: { label: 'Liberado p/ Transmissão', color: 'bg-cyan-100 text-cyan-700', icon: <Send className="h-4 w-4" /> },
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
  const navigate = useNavigate();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { user, isAdmin, hasAccess, permissions, sellerCodes: userSellerCodes = [], loading: adminLoading } = useStoreAdmin(store?.id);
  const qc = useQueryClient();
  const updateStore = useUpdateStore();
  const { data: categories = [] } = useCategories(store?.id);
  const { data: products = [] } = useProducts(store?.id);
  const { data: foodItems = [] } = useFoodItems(store?.id);
  const { data: orders = [] } = useOrders(hasAccess && (isAdmin || permissions.can_view_orders) ? store?.id : undefined);
  const { data: coupons = [] } = useCoupons(isAdmin ? store?.id : undefined);
  const { data: serviceOrders = [] } = useServiceOrders(hasAccess && store?.type === 'SERVICOS' && (isAdmin || permissions.can_view_service_orders) ? store?.id : undefined);
  const { data: customerProfiles = [] } = useStoreCustomerProfiles(
    hasAccess && (isAdmin || permissions.can_view_customers || (userSellerCodes && userSellerCodes.length > 0)) ? store?.id : undefined
  );
  const createServiceOrder = useCreateServiceOrder();
  const deleteServiceOrder = useDeleteServiceOrder();
  const updateCustomerProfile = useUpdateCustomerProfileAdmin();
  const createCustomerProfile = useCreateCustomerProfileAdmin();
  const toggleCustomerActive = useToggleCustomerActive();
  const deleteCustomerProfile = useDeleteCustomerProfile();

  // Senha inicial de acesso por código (mesma regra da importação de clientes)
  const initialCodePassword = (codigo: string) => {
    const c = (codigo || '').trim();
    return c.length >= 6 ? c : `dico${c}`;
  };

  // Cria (ou vincula) o acesso do cliente pelo código: login = código, senha = código
  const createCustomerAccess = async (params: { storeId: string; codigo: string; form: typeof customerForm }) => {
    const { form } = params;
    const { data, error } = await supabase.functions.invoke('import-customers', {
      body: {
        storeId: params.storeId,
        mode: 'import',
        rows: [{
          codigo: params.codigo,
          nome: form.name.trim(),
          cpf_cnpj: form.cpfCnpj,
          whatsapp: form.whatsapp,
          cep: form.cep,
          uf: form.uf,
          cidade: form.city,
          bairro: form.neighborhood,
          endereco: form.address,
          numero: form.number,
          complemento: form.complement,
          codigo_vendedor: form.sellerCode,
        }],
      },
    });
    if (error) throw error;
    const first = (data as any)?.results?.[0];
    if (first?.status === 'error') throw new Error(first.erro || 'Falha ao criar acesso');
    // campos que a rotina de importação não trata
    await supabase
      .from('customer_profiles')
      .update({ price_table: form.priceTable, transportadora: form.transportadora || null } as any)
      .eq('store_id', params.storeId)
      .eq('customer_code', params.codigo);
  };

  // Sellers (Dicolore)
  const { data: sellers = [] } = useAllStoreSellers(isAdmin && store?.slug === 'dicolore' ? store?.id : undefined);
  const createSeller = useCreateStoreSeller();
  const updateSeller = useUpdateStoreSeller();
  const deleteSeller = useDeleteStoreSeller();
  const sellerByCode = useMemo(() => {
    const m = new Map<string, typeof sellers[number]>();
    sellers.forEach(s => { if (s.code) m.set(s.code.trim(), s); });
    return m;
  }, [sellers]);

  // Seller-code based access restriction for non-admin store users
  const restrictBySeller = !isAdmin && (userSellerCodes?.length || 0) > 0;
  const sellerCodeSet = useMemo(() => new Set((userSellerCodes || []).map(c => String(c).trim()).filter(Boolean)), [userSellerCodes]);
  const last8 = (s: string) => (s || '').replace(/\D/g, '').slice(-8);
  const whatsappToSellerCode = useMemo(() => {
    const m = new Map<string, string>();
    (customerProfiles as any[]).forEach((cp: any) => {
      const k = last8(cp.whatsapp);
      const code = String(cp.sellerCode || '').trim();
      if (k && code) m.set(k, code);
    });
    return m;
  }, [customerProfiles]);
  const customerCodeLookup = useMemo(() => {
    const byDoc = new Map<string, string>();
    const byWa = new Map<string, string>();
    (customerProfiles as any[]).forEach((cp: any) => {
      const code = String(cp.customerCode || '').trim();
      if (!code) return;
      const doc = String(cp.cpfCnpj || '').replace(/\D/g, '');
      if (doc) byDoc.set(doc, code);
      const wa = last8(cp.whatsapp);
      if (wa) byWa.set(wa, code);
    });
    return { byDoc, byWa };
  }, [customerProfiles]);
  const resolveCustomerCode = (c: any): string => {
    const doc = String(c?.cpfCnpj || '').replace(/\D/g, '');
    if (doc && customerCodeLookup.byDoc.has(doc)) return customerCodeLookup.byDoc.get(doc)!;
    const wa = last8(c?.whatsapp || '');
    if (wa && customerCodeLookup.byWa.has(wa)) return customerCodeLookup.byWa.get(wa)!;
    return '';
  };
  const resolveOrderSellerName = (c: any): string | null => {
    const wa = last8(c?.whatsapp || '');
    const sellerCode = wa ? whatsappToSellerCode.get(wa) : undefined;
    if (!sellerCode) return null;
    return sellerByCode.get(sellerCode.trim())?.name || null;
  };

  const scopedCustomerProfiles = useMemo(() => {
    if (!restrictBySeller) return customerProfiles as any[];
    return (customerProfiles as any[]).filter((cp: any) => sellerCodeSet.has(String(cp.sellerCode || '').trim()));
  }, [customerProfiles, restrictBySeller, sellerCodeSet]);

  const [customerSearch, setCustomerSearch] = useState('');
  const filteredCustomerProfiles = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return scopedCustomerProfiles;
    const digits = term.replace(/\D/g, '');
    return scopedCustomerProfiles.filter((cp: any) => {
      const haystack = [
        cp.name, cp.customerCode, cp.cpfCnpj, cp.whatsapp,
        cp.address, cp.number, cp.neighborhood, cp.city, cp.uf, cp.cep, cp.complement,
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(term)) return true;
      if (digits.length >= 3) {
        const onlyDigits = haystack.replace(/\D/g, '');
        if (onlyDigits.includes(digits)) return true;
      }
      return false;
    });
  }, [scopedCustomerProfiles, customerSearch]);
  const scopedOrders = useMemo(() => {
    if (!restrictBySeller) return orders;
    return orders.filter((o: any) => {
      const code = whatsappToSellerCode.get(last8(o?.customer?.whatsapp || ''));
      return code ? sellerCodeSet.has(code) : false;
    });
  }, [orders, restrictBySeller, sellerCodeSet, whatsappToSellerCode]);

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
  const deleteOrder = useDeleteOrder();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();

  const [activeTab, setActiveTab] = useState('dashboard');

  // Pagination for Orders tab
  const [orderSearch, setOrderSearch] = useState('');
  const [orderSellerFilter, setOrderSellerFilter] = useState('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const searchedOrders = useMemo(() => {
    const term = orderSearch.trim().toLowerCase();
    const digits = term.replace(/\D/g, '');
    return scopedOrders.filter((o: any) => {
      if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
      if (orderSellerFilter !== 'all') {
        const code = whatsappToSellerCode.get(last8(o?.customer?.whatsapp || '')) || '';
        if (orderSellerFilter === 'none') {
          if (code) return false;
        } else if (code.trim() !== orderSellerFilter) return false;
      }
      if (!term) return true;
      const sellerName = resolveOrderSellerName(o.customer) || '';
      const haystack = [
        `#${o.orderNumber}`, String(o.orderNumber), o.customer?.name, o.customer?.whatsapp,
        resolveCustomerCode(o.customer), sellerName,
      ].filter(Boolean).join(' ').toLowerCase();
      if (haystack.includes(term)) return true;
      if (digits.length >= 3 && haystack.replace(/\D/g, '').includes(digits)) return true;
      return false;
    });
  }, [scopedOrders, orderSearch, orderSellerFilter, orderStatusFilter, whatsappToSellerCode, customerCodeLookup, sellerByCode]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const ordersTotalPages = Math.max(1, Math.ceil(searchedOrders.length / ordersPageSize));
  useEffect(() => { setOrdersPage(1); }, [ordersPageSize, searchedOrders.length, orderSearch, orderSellerFilter, orderStatusFilter]);
  const pagedOrders = useMemo(
    () => searchedOrders.slice((ordersPage - 1) * ordersPageSize, ordersPage * ordersPageSize),
    [searchedOrders, ordersPage, ordersPageSize],
  );

  // Auto-select default tab for restricted users
  useEffect(() => {
    if (!isAdmin && permissions.can_manage_tables &&
        !permissions.can_view_orders && !permissions.can_manage_orders &&
        !permissions.can_manage_products && !permissions.can_view_customers &&
        !permissions.can_view_service_orders && !permissions.can_manage_service_orders) {
      navigate(`/${slug}/garcom`, { replace: true });
      return;
    }
    const isDicolore = store?.slug === 'dicolore';
    const isSeller = !isAdmin && (userSellerCodes?.length || 0) > 0;
    if (isDicolore && isSeller) {
      setActiveTab('atendimento');
    } else if (!isAdmin && (permissions.can_view_service_orders || permissions.can_manage_service_orders)) {
      setActiveTab('service-orders');
    } else if (!isAdmin && (permissions.can_view_orders || permissions.can_manage_orders)) {
      setActiveTab('orders');
    } else if (!isAdmin && permissions.can_manage_products) {
      setActiveTab('products');
    } else if (!isAdmin && permissions.can_view_customers) {
      setActiveTab('customers');
    } else if (!isAdmin && permissions.can_manage_tables) {
      setActiveTab('tables');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, store?.slug, userSellerCodes?.length]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [editingCategoryCommission, setEditingCategoryCommission] = useState<string>('');
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importCustomersOpen, setImportCustomersOpen] = useState(false);
  const [filterCode, setFilterCode] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('all');
  const filteredProducts = useMemo(() => {
    const code = filterCode.trim().toLowerCase();
    const name = filterName.trim().toLowerCase();
    return products.filter(p => {
      if (code && !(p.code || '').toLowerCase().includes(code)) return false;
      if (name && !p.name.toLowerCase().includes(name)) return false;
      if (filterCategoryId !== 'all' && p.categoryId !== filterCategoryId) return false;
      return true;
    });
  }, [products, filterCode, filterName, filterCategoryId]);
  const hasProductFilter = !!(filterCode || filterName || filterCategoryId !== 'all');
  const [updateCustomersOpen, setUpdateCustomersOpen] = useState(false);
  const [syncingPrices, setSyncingPrices] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);
  const [syncingCustomers, setSyncingCustomers] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryCommission, setNewCategoryCommission] = useState<string>('');
  const [selectedSOId, setSelectedSOId] = useState<string | null>(null);
  const [soDialogOpen, setSODialogOpen] = useState(false);
  const selectedSO = useMemo(() => selectedSOId ? serviceOrders.find(s => s.id === selectedSOId) || null : null, [selectedSOId, serviceOrders]);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', whatsapp: '', address: '', number: '', city: '', uf: '', cep: '', neighborhood: '', complement: '', cpfCnpj: '', sellerCode: '', transportadora: '', priceTable: 4 as 1 | 4 | 9, customerCode: '' });
  const [downloadOrder, setDownloadOrder] = useState<any>(null);
  const [downloadFormat, setDownloadFormat] = useState<'xml' | 'txt'>('xml');
  const [downloadTelevendas, setDownloadTelevendas] = useState(false);
  const [resetPwdCustomer, setResetPwdCustomer] = useState<any>(null);
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Discount rules state
  const [discountRules, setDiscountRulesLocal] = useState<DiscountRule[]>([]);
  const [discountRulesInitialized, setDiscountRulesInitialized] = useState(false);
  const [newRule, setNewRule] = useState({ groupId: '', minQuantity: '', discountPercent: '', description: '', priceTable: 'all' as 'all' | '1' | '4' | '9' });
  const [savingRules, setSavingRules] = useState(false);
  const [importRulesOpen, setImportRulesOpen] = useState(false);

  // Settings state
  const [settingsName, setSettingsName] = useState('');
  const [settingsAddress, setSettingsAddress] = useState('');
  const [settingsPhone, setSettingsPhone] = useState('');
  const [settingsWhatsapp, setSettingsWhatsapp] = useState('');
  const [settingsLogo, setSettingsLogo] = useState('');
  const [settingsMinOrder, setSettingsMinOrder] = useState('0');
  const [settingsCnpj, setSettingsCnpj] = useState('');
  const [settingsInitialized, setSettingsInitialized] = useState(false);
  const [offersDelivery, setOffersDelivery] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Sellers state (Dicolore)
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerWhatsapp, setNewSellerWhatsapp] = useState('');
  const [newSellerCode, setNewSellerCode] = useState('');

  // Dicolore: confirmação para liberar pedido ao ERP via WhatsApp
  const [pendingErpRelease, setPendingErpRelease] = useState<{ orderId: string; orderNumber: number } | null>(null);

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

  // Material de Apoio rule
  const [maEnabled, setMaEnabled] = useState(false);
  const [maPercent, setMaPercent] = useState('4');
  const [maCategoryIds, setMaCategoryIds] = useState<string[]>([]);
  const [maInitialized, setMaInitialized] = useState(false);

  // Delivery neighborhoods (COMIDA / PIZZARIA)
  const [neighborhoods, setNeighborhoods] = useState<{ id: string; name: string; fee: number }[]>([]);
  const [neighborhoodsInit, setNeighborhoodsInit] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbFee, setNewNbFee] = useState('');

  const allProducts = store?.type === 'COMIDA' ? foodItems : products;

  // Initialize settings from store
  if (store && !settingsInitialized) {
    setSettingsName(store.name);
    setSettingsAddress(store.address);
    setSettingsPhone(store.phone);
    setSettingsWhatsapp(store.whatsapp);
    setSettingsLogo(store.logo);
    setSettingsMinOrder(String(store.settings?.minOrderValue ?? 0));
    setOffersDelivery(store.settings?.offersDelivery !== false);
    setSettingsCnpj(store.settings?.cnpj || '');
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

  if (store && !maInitialized) {
    const m = store.settings.materialApoio;
    if (m) {
      setMaEnabled(!!m.enabled);
      setMaPercent(String(m.maxPercent ?? 4));
      setMaCategoryIds(m.categoryIds || []);
    }
    setMaInitialized(true);
  }

  if (store && !neighborhoodsInit) {
    setNeighborhoods((store.settings as any)?.deliveryNeighborhoods || []);
    setNeighborhoodsInit(true);
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
  if (!hasAccess) {
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

  const handleSyncPrices = async () => {
    if (!store) return;
    setSyncingPrices(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-prices', {
        body: { store_id: store.id },
      });
      if (error) throw error;
      const parts: string[] = [];
      if (data?.updated_prices > 0) parts.push(`${data.updated_prices} preço(s)`);
      if (data?.updated_names > 0) parts.push(`${data.updated_names} nome(s)`);
      if (data?.updated_categories > 0) parts.push(`${data.updated_categories} categoria(s)`);
      if (data?.created_categories > 0) parts.push(`${data.created_categories} categoria(s) criada(s)`);
      if (data?.created_products > 0) parts.push(`${data.created_products} produto(s) criado(s)`);
      if (data?.deactivated_products > 0) parts.push(`${data.deactivated_products} produto(s) inativado(s)`);
      if (data?.reactivated_products > 0) parts.push(`${data.reactivated_products} produto(s) reativado(s)`);
      if (data?.categories_merged > 0) parts.push(`${data.categories_merged} categoria(s) mesclada(s)`);
      if (data?.categories_deleted > 0) parts.push(`${data.categories_deleted} categoria(s) removida(s)`);
      if (parts.length > 0) {
        toast.success(`Atualizado: ${parts.join(', ')}. Planilha: ${data.total_sheet_codes} códigos / Banco: ${data.total_products} produtos`);
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['categories'] });
      } else {
        toast.info(`Nenhuma alteração necessária. Planilha: ${data?.total_sheet_codes || 0} códigos / Banco: ${data?.total_products || 0} produtos`);
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar preços: ' + (err.message || err));
    } finally {
      setSyncingPrices(false);
    }
  };

  const handleSyncStock = async () => {
    if (!store) return;
    setSyncingStock(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-stock', {
        body: { store_id: store.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const base = `Planilha: ${data?.total_sheet_codes || 0} códigos / Banco: ${data?.total_products || 0} produtos`;
      if ((data?.updated_stock || 0) > 0) {
        const extra: string[] = [];
        if (data.zeroed_products > 0) extra.push(`${data.zeroed_products} zerado(s)`);
        if (data.not_found > 0) extra.push(`${data.not_found} código(s) não encontrado(s)`);
        toast.success(
          `Estoque atualizado: ${data.updated_stock} produto(s)${extra.length ? ` (${extra.join(', ')})` : ''}. ${base}`
        );
        qc.invalidateQueries({ queryKey: ['products'] });
      } else {
        toast.info(`Nenhuma alteração de estoque. ${base}`);
      }
    } catch (err: any) {
      toast.error('Erro ao sincronizar estoque: ' + (err.message || err));
    } finally {
      setSyncingStock(false);
    }
  };

  const handleSyncCustomers = async () => {
    if (!store) return;
    setSyncingCustomers(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-customers', {
        body: { store_id: store.id },
      });
      if (error) throw error;
      const parts: string[] = [];
      if (data?.created > 0) parts.push(`${data.created} criado(s)`);
      if (data?.updated > 0) parts.push(`${data.updated} atualizado(s)`);
      if (data?.deactivated > 0) parts.push(`${data.deactivated} desativado(s)`);
      if (data?.errors > 0) parts.push(`${data.errors} erro(s)`);
      if (parts.length > 0) {
        toast.success(`Clientes sincronizados: ${parts.join(', ')} (planilha: ${data?.total_sheet_rows || 0})`);
      } else {
        toast.info(`Nenhuma alteração. Planilha: ${data?.total_sheet_rows || 0} / Banco: ${data?.total_db_rows || 0}`);
      }
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', store.id] });
    } catch (err: any) {
      toast.error('Erro ao sincronizar clientes: ' + (err?.message || err));
    } finally {
      setSyncingCustomers(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({
      storeId: store.id,
      name: newCategoryName,
      commissionPercent: store.slug === 'dicolore' ? Number(newCategoryCommission.replace(',', '.')) || 0 : undefined,
    });
    setNewCategoryName('');
    setNewCategoryCommission('');
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
    const cat = categories.find(c => c.id === id);
    setEditingCategoryCommission(cat?.commissionPercent ? String(cat.commissionPercent) : '');
  };

  const handleSaveCategory = async () => {
    if (!editingCategoryId || !editingCategoryName.trim()) return;
    await updateCategory.mutateAsync({
      id: editingCategoryId,
      name: editingCategoryName.trim(),
      commissionPercent: store.slug === 'dicolore' ? Number(editingCategoryCommission.replace(',', '.')) || 0 : undefined,
    });
    setEditingCategoryId(null);
    setEditingCategoryName('');
    setEditingCategoryCommission('');
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
        settings: {
          ...store.settings,
          shipping: shippingData,
          minOrderValue: Math.max(0, parseFloat(settingsMinOrder.replace(',', '.')) || 0),
          offersDelivery,
          cnpj: settingsCnpj.replace(/\D/g, ''),
          materialApoio: {
            enabled: maEnabled,
            maxPercent: Math.max(0, parseFloat(maPercent.replace(',', '.')) || 0),
            categoryIds: maCategoryIds,
          } as MaterialApoioSettings,
          deliveryNeighborhoods: neighborhoods,
        },
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
      priceTable: newRule.priceTable === 'all' ? undefined : (Number(newRule.priceTable) as 1 | 4 | 9),
    };
    setDiscountRulesLocal(prev => [...prev, rule]);
    setNewRule({ groupId: '', minQuantity: '', discountPercent: '', description: '', priceTable: newRule.priceTable });
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="gradient-primary text-primary-foreground">
        <div className="container py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Button variant="ghost" size="icon" asChild className="text-primary-foreground hover:bg-primary-foreground/10 flex-shrink-0">
                <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold break-words line-clamp-2">{store.name}</h1>
                <p className="text-xs sm:text-sm text-primary-foreground/80">
                  Painel da Loja
                  {user?.email && (
                    <span className="ml-2 opacity-90">· <span className="font-medium">{user.email}</span></span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <RefreshButton
                variant="outline"
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent h-9 px-3"
              />
              <Button variant="outline" size="sm" asChild className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-9">
                <Link to={`/${store.slug}`}><Eye className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Ver Loja</span></Link>
              </Button>
              <Button variant="ghost" size="sm" className="text-primary-foreground hover:text-primary-foreground/80 h-9" onClick={() => { supabase.auth.signOut(); }}>
                <LogOut className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6">
        <div className="mb-4">
          <PushNotificationsCard storeId={store.id} />
        </div>
        {(() => {
          const ls = getLicenseStatus(store.licenseExpiresAt);
          if (ls.level !== 'warning' && ls.level !== 'expired') return null;
          const expired = ls.level === 'expired';
          return (
            <div className={cn(
              'mb-6 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between',
              expired ? 'border-red-300 bg-red-50 text-red-900' : 'border-yellow-300 bg-yellow-50 text-yellow-900'
            )}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">
                    {expired
                      ? `Sua licença venceu em ${ls.formatted}`
                      : `Sua licença vence em ${ls.daysLeft} dia${ls.daysLeft === 1 ? '' : 's'} (${ls.formatted})`}
                  </p>
                  <p className="opacity-90">Entre em contato com o suporte para renovar e evitar a inativação da loja.</p>
                </div>
              </div>
              <Button asChild size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                <a href={buildRenewalLink(store)} target="_blank" rel="noopener noreferrer">Falar com Suporte</a>
              </Button>
            </div>
          );
        })()}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex flex-wrap h-auto gap-1">
            {isAdmin && (
              <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
            )}
            {(isAdmin || permissions.can_manage_products) && (
              <TabsTrigger value="products" className="gap-2"><Package className="h-4 w-4" /> Produtos</TabsTrigger>
            )}
            {(isAdmin || permissions.can_manage_products) && (
              <TabsTrigger value="categories" className="gap-2"><Tags className="h-4 w-4" /> Categorias</TabsTrigger>
            )}
            {(isAdmin || permissions.can_view_orders || permissions.can_manage_orders) && (
              <TabsTrigger value="orders" className="gap-2">
                <ShoppingCart className="h-4 w-4" /> Pedidos
                {stats.pendingOrders > 0 && <Badge className="ml-1 bg-destructive text-destructive-foreground">{stats.pendingOrders}</Badge>}
              </TabsTrigger>
            )}
            {store.slug === 'dicolore' && (isAdmin || (userSellerCodes?.length || 0) > 0) && (
              <TabsTrigger value="atendimento" className="gap-2"><MapPin className="h-4 w-4" /> Atendimento</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="coupons" className="gap-2"><Percent className="h-4 w-4" /> Cupons</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="discounts" className="gap-2"><Layers className="h-4 w-4" /> Descontos</TabsTrigger>
            )}
            {store.type === 'SERVICOS' && (isAdmin || permissions.can_view_service_orders || permissions.can_manage_service_orders) && (
              <TabsTrigger value="service-orders" className="gap-2"><ClipboardList className="h-4 w-4" /> Ordens de Serviço</TabsTrigger>
            )}
            {store.type === 'SALAO' && isAdmin && (
              <TabsTrigger value="salon" className="gap-2"><Scissors className="h-4 w-4" /> Salão</TabsTrigger>
            )}
            {store.type === 'COMIDA' && isAdmin && (
              <TabsTrigger value="ingredients" className="gap-2"><Salad className="h-4 w-4" /> Ingredientes</TabsTrigger>
            )}
            {store.type === 'COMIDA' && isAdmin && (
              <TabsTrigger value="borders" className="gap-2"><Pizza className="h-4 w-4" /> Bordas</TabsTrigger>
            )}
            {store.type === 'COMIDA' && (isAdmin || permissions.can_manage_tables) && (
              <TabsTrigger value="tables" className="gap-2"><Grid3x3 className="h-4 w-4" /> Mesas</TabsTrigger>
            )}
            {(isAdmin || permissions.can_view_customers) && (
              <TabsTrigger value="customers" className="gap-2"><Users className="h-4 w-4" /> Clientes</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="visits" className="gap-2"><BarChart3 className="h-4 w-4" /> Visitas</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="users" className="gap-2"><UserCog className="h-4 w-4" /> Usuários</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="hours" className="gap-2"><Clock className="h-4 w-4" /> Horários</TabsTrigger>
            )}
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
                                  {item.ingredients?.length > 0 && (
                                    <div className="pl-3 opacity-80">+ {item.ingredients.map((x: any) => x.name).join(', ')}</div>
                                  )}
                                  {item.removedIngredients?.length > 0 && (
                                    <div className="pl-3 opacity-80">− {item.removedIngredients.map((x: any) => x.name).join(', ')}</div>
                                  )}
                                  {item.border && (
                                    <div className="pl-3 opacity-80">Borda: {item.border.name}</div>
                                  )}
                                  {item.observation && (
                                    <div className="pl-3 italic opacity-80">Obs: {item.observation}</div>
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
                {store.slug === 'dicolore' && (
                  <Button variant="outline" className="gap-2" onClick={handleSyncStock} disabled={syncingStock}>
                    {syncingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar Estoque
                  </Button>
                )}
                <Button variant="outline" className="gap-2" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-4 w-4" /> Importar Excel
                </Button>
                <Button className="gap-2" onClick={handleNewProduct}><Plus className="h-4 w-4" /> Novo Produto</Button>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input
                value={filterCode}
                onChange={e => setFilterCode(e.target.value)}
                placeholder="Buscar por código"
                className="w-full sm:w-48"
              />
              <Input
                value={filterName}
                onChange={e => setFilterName(e.target.value)}
                placeholder="Buscar por produto"
                className="w-full sm:w-64"
              />
              <Select value={filterCategoryId} onValueChange={setFilterCategoryId}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filterCode || filterName || filterCategoryId !== 'all') && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterCode(''); setFilterName(''); setFilterCategoryId('all'); }}>
                  Limpar filtros
                </Button>
              )}
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
                      <TableHead>Estoque</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map(product => (
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
                        <TableCell>
                          {(product.stock ?? 0) > 0 ? (
                            <span className="font-medium">{product.stock}</span>
                          ) : (
                            <span className="text-destructive font-medium">0</span>
                          )}
                        </TableCell>
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
                    {filteredProducts.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">{hasProductFilter ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}</TableCell></TableRow>
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
                {store.slug === 'dicolore' && (
                  <Input
                    value={newCategoryCommission}
                    onChange={e => setNewCategoryCommission(e.target.value)}
                    placeholder="Comissão %"
                    inputMode="decimal"
                    className="w-28"
                  />
                )}
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
                        {store.slug === 'dicolore' && (
                          <Input
                            value={editingCategoryCommission}
                            onChange={e => setEditingCategoryCommission(e.target.value)}
                            placeholder="Comissão %"
                            inputMode="decimal"
                            className="w-24"
                          />
                        )}
                        <Button size="sm" onClick={handleSaveCategory}>Salvar</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingCategoryId(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {products.filter(p => p.categoryId === category.id).length} produtos
                            {store.slug === 'dicolore' && (
                              <> · Comissão: {(category.commissionPercent || 0).toFixed(2)}%</>
                            )}
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
              <div className="flex items-center gap-2">
                {!isAdmin && !permissions.can_manage_orders && (
                  <Badge variant="secondary">Modo somente leitura</Badge>
                )}
                {(isAdmin || permissions.can_manage_orders) && (
                  <Button variant="outline" onClick={() => setNewOrderDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Pedido
                  </Button>
                )}
              </div>
            </div>
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Pesquisar por nº do pedido, cliente, código ou WhatsApp"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                    value={orderSellerFilter}
                    onChange={(e) => setOrderSellerFilter(e.target.value)}
                  >
                    <option value="all">Todos os representantes</option>
                    <option value="none">Sem representante</option>
                    {sellers.map((s: any) => (
                      <option key={s.id} value={String(s.code || '').trim()}>{s.name}</option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border bg-background px-2 text-sm"
                    value={orderStatusFilter}
                    onChange={(e) => setOrderStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos os status</option>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                  {(orderSearch.trim() || orderSellerFilter !== 'all' || orderStatusFilter !== 'all') && (
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{searchedOrders.length} encontrado(s)</span>
                      <Button variant="ghost" size="sm" onClick={() => { setOrderSearch(''); setOrderSellerFilter('all'); setOrderStatusFilter('all'); }}>
                        Limpar
                      </Button>
                    </div>
                  )}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead><TableHead>Cliente</TableHead><TableHead>Itens</TableHead>
                      <TableHead>Total</TableHead><TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                   <TableBody>
                     {pagedOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <p className="font-medium">#{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                        </TableCell>
                        <TableCell>
                          {order.origem === 'mesa' && (
                            <Badge className="bg-orange-100 text-orange-700 mb-1">🍽 MESA</Badge>
                          )}
                          <p className="font-medium">{order.customer.name}</p>
                          {order.origem !== 'mesa' && (
                            <p className="text-xs text-muted-foreground">{order.customer.whatsapp}</p>
                          )}
                          {order.origem !== 'mesa' && (() => {
                            const code = resolveCustomerCode(order.customer);
                            return code ? <p className="text-xs text-muted-foreground">Código: {code}</p> : null;
                          })()}
                          {order.origem !== 'mesa' && (() => {
                            const sellerName = resolveOrderSellerName(order.customer);
                            return sellerName ? <p className="text-xs text-destructive">Vendedor: {sellerName}</p> : null;
                          })()}

                        </TableCell>
                         <TableCell>
                            <div className="space-y-0.5 min-w-[180px]">
                              {order.items.map((item: any, i: number) => (
                                <div key={i} className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{item.quantity}x</span> {item.name}
                                  {(item.size || item.color) && (
                                    <span className="ml-1 opacity-70">— {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                                  )}
                                  {item.ingredients?.length > 0 && (
                                    <div className="pl-3 opacity-80">+ {item.ingredients.map((x: any) => x.name).join(', ')}</div>
                                  )}
                                  {item.removedIngredients?.length > 0 && (
                                    <div className="pl-3 opacity-80">− {item.removedIngredients.map((x: any) => x.name).join(', ')}</div>
                                  )}
                                  {item.border && (
                                    <div className="pl-3 opacity-80">Borda: {item.border.name}</div>
                                  )}
                                  {item.observation && (
                                    <div className="pl-3 italic opacity-80">Obs: {item.observation}</div>
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
                                if (!isAdmin && !permissions.can_manage_orders) return null;
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
                                if (order.status === 'cancelado') {
                                  return (
                                    <Button variant="ghost" size="sm" className="text-xs text-destructive" title="Excluir pedido" onClick={async () => {
                                      if (!confirm('Excluir permanentemente este pedido cancelado?')) return;
                                      const so = serviceOrders.find(s => s.orderId === order.id);
                                      if (so) {
                                        await deleteServiceOrder.mutateAsync({ id: so.id, storeId: store.id });
                                      }
                                      await deleteOrder.mutateAsync({ id: order.id, storeId: store.id });
                                      toast.success('Pedido excluído!');
                                    }}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ) : (
                            (isAdmin || permissions.can_manage_orders) ? (
                            <div className="flex items-center gap-1">
                              <Select value={order.status} disabled={updatingStatusId === order.id} onValueChange={async (value) => {
                                if (store.slug === 'dicolore' && value === 'liberado_transmissao') {
                                  setPendingErpRelease({ orderId: order.id, orderNumber: order.orderNumber });
                                  return;
                                }
                                setUpdatingStatusId(order.id);
                                try {
                                  await updateOrderStatus.mutateAsync({ id: order.id, status: value as OrderStatus });
                                  toast.success('Status atualizado!');
                                } catch (err: any) {
                                  toast.error(err?.message || 'Erro ao atualizar status');
                                } finally {
                                  setUpdatingStatusId(null);
                                }
                              }}>
                                <SelectTrigger className="w-32">
                                  {updatingStatusId === order.id ? (
                                    <Badge className={statusConfig[order.status]?.color}>
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span className="ml-1">Salvando...</span>
                                    </Badge>
                                  ) : (
                                    <Badge className={statusConfig[order.status]?.color}>
                                      {statusConfig[order.status]?.icon}
                                      <span className="ml-1">{statusConfig[order.status]?.label}</span>
                                    </Badge>
                                  )}
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(statusConfig).map(([key, cfg]) => (
                                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {order.status === 'cancelado' && (
                                <Button variant="ghost" size="sm" className="text-destructive" title="Excluir pedido" onClick={async () => {
                                  if (!confirm('Excluir permanentemente este pedido cancelado?')) return;
                                  await deleteOrder.mutateAsync({ id: order.id, storeId: store.id });
                                  toast.success('Pedido excluído!');
                                }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            ) : (
                              <Badge className={statusConfig[order.status]?.color}>
                                {statusConfig[order.status]?.icon}
                                <span className="ml-1">{statusConfig[order.status]?.label}</span>
                              </Badge>
                            )
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {store.type === 'SERVICOS' && (isAdmin || permissions.can_manage_service_orders || permissions.can_view_service_orders) && (() => {
                              const existingSO = serviceOrders.find(so => so.orderId === order.id);
                              if (existingSO) {
                                return (
                                  <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
                                    setSelectedSOId(existingSO.id);
                                    setSODialogOpen(true);
                                  }}>
                                    <ClipboardList className="h-3 w-3" /> {(isAdmin || permissions.can_manage_service_orders) ? 'Abrir OS' : 'Ver OS'}
                                  </Button>
                                );
                              }
                              if (!isAdmin && !permissions.can_manage_service_orders) return null;
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
                                  printOrder(order, store.name, 'thermal', { extraItems: so?.extraItems, discountRules: store?.settings?.discountRules });
                                }}>
                                  Impressora Térmica (80mm)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const so = serviceOrders.find(s => s.orderId === order.id);
                                  printOrder(order, store.name, 'a4', { extraItems: so?.extraItems, discountRules: store?.settings?.discountRules });
                                }}>
                                  Folha A4
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="ghost" size="icon" title="Baixar pedido" onClick={() => {
                              setDownloadOrder(order);
                              setDownloadFormat('xml');
                              setDownloadTelevendas(false);
                            }}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {order.status !== 'cancelado' && (isAdmin || permissions.can_manage_orders || restrictBySeller) && (() => {
                              if (restrictBySeller) {
                                const code = whatsappToSellerCode.get(last8(order?.customer?.whatsapp || ''));
                                if (!code || !sellerCodeSet.has(code)) return false;
                              }
                              return true;
                            })() && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Editar pedido"
                                onClick={() => setEditingOrder(order)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
                {searchedOrders.length > ordersPageSize && (
                  <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-muted-foreground">
                      Mostrando {(ordersPage - 1) * ordersPageSize + 1}–{Math.min(ordersPage * ordersPageSize, searchedOrders.length)} de {searchedOrders.length} pedidos
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded border bg-background px-2 text-xs"
                        value={ordersPageSize}
                        onChange={(e) => setOrdersPageSize(Number(e.target.value))}
                      >
                        <option value={20}>20/pág</option>
                        <option value={50}>50/pág</option>
                        <option value={100}>100/pág</option>
                      </select>
                      <Button size="sm" variant="outline" disabled={ordersPage === 1} onClick={() => setOrdersPage(p => Math.max(1, p - 1))}>
                        Anterior
                      </Button>
                      <span className="text-xs">Pág {ordersPage} de {ordersTotalPages}</span>
                      <Button size="sm" variant="outline" disabled={ordersPage >= ordersTotalPages} onClick={() => setOrdersPage(p => Math.min(ordersTotalPages, p + 1))}>
                        Próxima
                      </Button>
                    </div>
                  </div>
                )}
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
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
                      <Label className="text-sm">Tabela de Preço</Label>
                      <Select
                        value={newRule.priceTable}
                        onValueChange={(v) => setNewRule(r => ({ ...r, priceTable: v as 'all' | '1' | '4' | '9' }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="1">Tabela 1</SelectItem>
                          <SelectItem value="4">Tabela 4</SelectItem>
                          <SelectItem value="9">Tabela 9</SelectItem>
                        </SelectContent>
                      </Select>
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setImportRulesOpen(true)}>
                      <Upload className="h-4 w-4" /> Importar Planilha
                    </Button>
                    <Button onClick={handleSaveDiscountRules} disabled={savingRules} size="sm" className="gap-2">
                      {savingRules ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Salvar Regras
                    </Button>
                  </div>
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
                          <TableHead>Tabela</TableHead>
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
                            <TableCell>
                              <Badge variant="outline">{rule.priceTable ? `Tab. ${rule.priceTable}` : 'Todas'}</Badge>
                            </TableCell>
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

          {/* Atendimento (Dicolore) */}
          {store.slug === 'dicolore' && (isAdmin || (userSellerCodes?.length || 0) > 0) && (
            <TabsContent value="atendimento" className="animate-fade-in">
              <AtendimentoTab
                storeId={store.id}
                sellerCodes={userSellerCodes || []}
                isAdmin={isAdmin}
              />
            </TabsContent>
          )}

          {/* Settings */}
          <TabsContent value="settings" className="animate-fade-in">
            <div className="space-y-6">
            <ChangePasswordCard />
            <OrderErrorsDiagnosticsCard storeId={store.id} />
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
                <div className="grid gap-2 sm:max-w-md">
                  <Label>CNPJ (impresso nos comprovantes)</Label>
                  <Input value={settingsCnpj} onChange={e => setSettingsCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
                  <p className="text-xs text-muted-foreground">Usado no comprovante de pagamento (não fiscal).</p>
                </div>
                <div className="grid gap-2 sm:max-w-xs">
                  <Label>Pedido mínimo (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={settingsMinOrder}
                    onChange={e => setSettingsMinOrder(e.target.value)}
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">
                    Deixe 0 para desativar. Pedidos abaixo deste valor não poderão ser finalizados.
                  </p>
                </div>
                <div className="grid gap-2 rounded-md border p-3 sm:max-w-md">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="cursor-pointer" onClick={() => setOffersDelivery(!offersDelivery)}>
                      Oferece entrega?
                    </Label>
                    <button
                      type="button"
                      onClick={() => setOffersDelivery(!offersDelivery)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Alternar entrega"
                    >
                      {offersDelivery ? <ToggleRight className="h-6 w-6 text-accent" /> : <ToggleLeft className="h-6 w-6" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quando <strong>desligado</strong>, o checkout pede apenas <strong>nome e WhatsApp</strong> do cliente —
                    sem endereço, bairro ou taxa de entrega.
                  </p>
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

            {/* Bairros de entrega — COMIDA / PIZZARIA */}
            {(store.type === 'COMIDA' || store.type === 'PIZZARIA') && (
              <Card className="mt-6">
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Bairros atendidos e taxa de entrega</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Cadastre os bairros que sua empresa atende e a respectiva taxa de entrega. No checkout, o cliente
                    escolherá entre <strong>Entregar</strong> (com taxa do bairro) ou <strong>Retirar na loja</strong> (sem taxa).
                  </p>

                  <div className="rounded-md border divide-y">
                    {neighborhoods.length === 0 && (
                      <div className="p-4 text-center text-sm text-muted-foreground">Nenhum bairro cadastrado.</div>
                    )}
                    {neighborhoods.map((nb, idx) => (
                      <div key={nb.id} className="flex items-center gap-2 p-2">
                        <Input
                          className="flex-1"
                          value={nb.name}
                          onChange={e => setNeighborhoods(list => list.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                        />
                        <div className="relative w-32">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                          <Input
                            className="pl-8"
                            type="number"
                            step="0.01"
                            value={nb.fee}
                            onChange={e => setNeighborhoods(list => list.map((x, i) => i === idx ? { ...x, fee: parseFloat(e.target.value) || 0 } : x))}
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive"
                          onClick={() => setNeighborhoods(list => list.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1 grid gap-1">
                      <Label className="text-xs">Novo bairro</Label>
                      <Input value={newNbName} onChange={e => setNewNbName(e.target.value)} placeholder="Ex.: Centro" />
                    </div>
                    <div className="grid gap-1 w-32">
                      <Label className="text-xs">Taxa (R$)</Label>
                      <Input type="number" step="0.01" value={newNbFee} onChange={e => setNewNbFee(e.target.value)} placeholder="0,00" />
                    </div>
                    <Button
                      onClick={() => {
                        const name = newNbName.trim();
                        if (!name) { toast.error('Informe o nome do bairro'); return; }
                        const fee = parseFloat(String(newNbFee).replace(',', '.')) || 0;
                        setNeighborhoods(list => [...list, { id: crypto.randomUUID(), name, fee }]);
                        setNewNbName(''); setNewNbFee('');
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>

                  <Button onClick={handleSaveSettings} disabled={updateStore.isPending} size="sm">
                    {updateStore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar Bairros
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Otimizar Imagens */}
            <Card className="mt-6">
              <CardHeader><CardTitle className="flex items-center gap-2"><Percent className="h-5 w-5" /> Regra de Material de Apoio</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Limita o valor de produtos das categorias selecionadas a um % do valor das demais categorias do pedido.
                  Exemplo: 4% — em um pedido com R$ 1.000 de outros produtos, o cliente pode incluir até R$ 40,00 em produtos das categorias de apoio.
                </p>
                <div className="flex items-center gap-3">
                  <Label>Ativar regra</Label>
                  <Switch checked={maEnabled} onCheckedChange={setMaEnabled} />
                </div>
                {maEnabled && (
                  <>
                    <div className="grid gap-2 sm:max-w-xs">
                      <Label>% máximo sobre o pedido</Label>
                      <Input type="number" min="0" step="0.1" value={maPercent} onChange={e => setMaPercent(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label>Categorias consideradas "material de apoio"</Label>
                      {categories.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma categoria cadastrada.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {categories.map(cat => {
                            const checked = maCategoryIds.includes(cat.id);
                            return (
                              <label key={cat.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={e => {
                                    setMaCategoryIds(prev =>
                                      e.target.checked ? [...prev, cat.id] : prev.filter(id => id !== cat.id)
                                    );
                                  }}
                                />
                                <span className="text-sm">{cat.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <Button onClick={handleSaveSettings} disabled={updateStore.isPending} size="sm">
                  {updateStore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar Regra
                </Button>
              </CardContent>
            </Card>

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
              <DicolorePaymentCodesTab store={store} />
            )}

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
                    <div className="grid gap-1 w-24">
                      <Label className="text-xs">Código</Label>
                      <Input value={newSellerCode} onChange={e => setNewSellerCode(e.target.value)} placeholder="001" />
                    </div>
                    <div className="grid gap-1 flex-1">
                      <Label className="text-xs">WhatsApp</Label>
                      <Input value={newSellerWhatsapp} onChange={e => setNewSellerWhatsapp(e.target.value)} placeholder="5547999999999" />
                    </div>
                    <Button size="sm" disabled={!newSellerName.trim() || !newSellerWhatsapp.trim() || createSeller.isPending} onClick={async () => {
                      await createSeller.mutateAsync({ store_id: store.id, name: newSellerName.trim(), whatsapp: newSellerWhatsapp.trim(), code: newSellerCode.trim() });
                      setNewSellerName(''); setNewSellerWhatsapp(''); setNewSellerCode('');
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
                          <TableHead>Código</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sellers.map(s => (
                          <TableRow key={s.id}>
                            <TableCell>
                              <Input
                                defaultValue={s.name}
                                className="h-8"
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== s.name) {
                                    updateSeller.mutate({ id: s.id, name: v });
                                    toast.success('Nome atualizado');
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                defaultValue={s.code || ''}
                                className="h-8 w-24"
                                placeholder="—"
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (s.code || '')) {
                                    if (v && sellers.some(x => x.id !== s.id && (x.code || '').trim() === v)) {
                                      toast.error('Código já usado por outro vendedor');
                                      e.target.value = s.code || '';
                                      return;
                                    }
                                    updateSeller.mutate({ id: s.id, code: v });
                                    toast.success('Código atualizado');
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                defaultValue={s.whatsapp}
                                className="h-8 w-40"
                                placeholder="—"
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v !== (s.whatsapp || '')) {
                                    updateSeller.mutate({ id: s.id, whatsapp: v });
                                    toast.success('WhatsApp atualizado');
                                  }
                                }}
                              />
                            </TableCell>
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
            </div>
          </TabsContent>

          {/* Service Orders - only for SERVICOS */}
          {store.type === 'SERVICOS' && (
            <TabsContent value="service-orders" className="animate-fade-in">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Ordens de Serviço</h3>
                {!isAdmin && !permissions.can_manage_service_orders && (
                  <Badge variant="secondary">Modo somente leitura</Badge>
                )}
              </div>
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
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedSOId(so.id); setSODialogOpen(true); }} title={(isAdmin || permissions.can_manage_service_orders) ? 'Editar OS' : 'Ver / Imprimir OS'}>
                                {(isAdmin || permissions.can_manage_service_orders) ? <Edit2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                              {so.status === 'cancelada' && (isAdmin || permissions.can_manage_service_orders) && (
                                <Button variant="ghost" size="sm" className="text-destructive" title="Excluir OS" onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!confirm('Excluir permanentemente esta OS cancelada?')) return;
                                  try {
                                    await deleteServiceOrder.mutateAsync({ id: so.id, storeId: store.id });
                                    if (so.orderId) {
                                      await deleteOrder.mutateAsync({ id: so.orderId, storeId: store.id });
                                    }
                                    toast.success('OS excluída!');
                                  } catch (err: any) {
                                    toast.error(err.message || 'Erro ao excluir OS');
                                  }
                                }}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
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

          {/* Salon - only for SALAO */}
          {store.type === 'SALAO' && (
            <TabsContent value="salon" className="animate-fade-in">
              <SalonAdminTab storeId={store.id} />
            </TabsContent>
          )}

          {store.type === 'COMIDA' && (
            <TabsContent value="ingredients" className="animate-fade-in">
              <IngredientsTab storeId={store.id} />
            </TabsContent>
          )}
          {store.type === 'COMIDA' && (
            <TabsContent value="borders" className="animate-fade-in">
              <PizzaBordersTab storeId={store.id} />
            </TabsContent>
          )}
          {store.type === 'COMIDA' && (
            <TabsContent value="tables" className="animate-fade-in">
              <TablesTab storeId={store.id} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="hours" className="animate-fade-in">
              <BusinessHoursTab store={store} />
            </TabsContent>
          )}

          {/* Customers */}
          <TabsContent value="customers" className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Clientes Cadastrados</h3>
              <div className="flex gap-2">
                {store.slug === 'dicolore' ? (
                  <Button size="sm" variant="outline" onClick={handleSyncCustomers} disabled={syncingCustomers}>
                    {syncingCustomers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Atualizar Clientes
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setUpdateCustomersOpen(true)}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Atualizar Clientes
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setImportCustomersOpen(true)}>
                      <Upload className="mr-2 h-4 w-4" /> Importar Clientes
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => {
                  setCreatingCustomer(true);
                  setCustomerForm({ name: '', whatsapp: '', address: '', number: '', city: '', uf: '', cep: '', neighborhood: '', complement: '', cpfCnpj: '', sellerCode: '', transportadora: '', priceTable: 4, customerCode: '' });
                }}>
                  <Plus className="mr-2 h-4 w-4" /> Novo Cliente
                </Button>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Pesquisar por nome, código, CPF/CNPJ, endereço, cidade ou WhatsApp"
                  className="pl-9"
                />
              </div>
              {customerSearch.trim() && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setCustomerSearch('')}>Limpar</Button>
                  <span className="text-sm text-muted-foreground">{filteredCustomerProfiles.length} resultado(s)</span>
                </>
              )}
            </div>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>CPF/CNPJ</TableHead><TableHead>Representante</TableHead><TableHead>WhatsApp</TableHead><TableHead>Cidade/UF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomerProfiles.map(cp => (
                      <TableRow key={cp.id} className={!(cp as any).isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium">{cp.name || '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{(cp as any).customerCode || '—'}</TableCell>
                        <TableCell>{cp.cpfCnpj || '—'}</TableCell>
                        <TableCell>{(cp as any).sellerCode ? (sellerByCode.get(((cp as any).sellerCode || '').trim())?.name || (cp as any).sellerCode) : '—'}</TableCell>
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
                              cpfCnpj: cp.cpfCnpj || '',
                              sellerCode: (cp as any).sellerCode || '',
                              transportadora: (cp as any).transportadora || '',
                              priceTable: ((cp as any).priceTable === 1 || (cp as any).priceTable === 9 ? (cp as any).priceTable : 4) as 1 | 4 | 9,
                              customerCode: (cp as any).customerCode || '',
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
                            title={cp.userId ? 'Redefinir senha' : 'Cliente sem conta de acesso'}
                            disabled={!cp.userId}
                            onClick={() => {
                              setResetPwdCustomer(cp);
                              setResetPwdValue('');
                            }}
                          >
                            <KeyRound className="h-4 w-4 text-blue-600" />
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
                    {filteredCustomerProfiles.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        {customerSearch.trim() ? 'Nenhum cliente encontrado para a pesquisa' : 'Nenhum cliente cadastrado ainda'}
                      </TableCell></TableRow>
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
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div className="grid gap-1"><Label className="text-sm">CPF/CNPJ</Label><Input value={customerForm.cpfCnpj} onChange={e => setCustomerForm(f => ({ ...f, cpfCnpj: e.target.value }))} placeholder="Apenas números ou formatado" /></div>
                      <div className="grid gap-1"><Label className="text-sm">Código Vendedor</Label><Input value={customerForm.sellerCode} onChange={e => setCustomerForm(f => ({ ...f, sellerCode: e.target.value }))} placeholder="Ex.: 4" /></div>
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-sm">Código do Cliente (ERP)</Label>
                      <Input value={customerForm.customerCode} onChange={e => setCustomerForm(f => ({ ...f, customerCode: e.target.value }))} placeholder="Ex.: 98216" />
                      <p className="text-xs text-muted-foreground">
                        {editingCustomer?.userId
                          ? 'Este cliente já possui acesso. Para trocar a senha, use o botão de chave na lista.'
                          : 'Ao salvar com código, o acesso do cliente é criado (login e senha = código).'}
                      </p>
                    </div>
                    <div className="grid gap-1"><Label className="text-sm">Transportadora</Label><Input value={customerForm.transportadora} onChange={e => setCustomerForm(f => ({ ...f, transportadora: e.target.value }))} placeholder="Nome da transportadora" /></div>
                    <div className="grid gap-1">
                      <Label className="text-sm">Tabela de Preço</Label>
                      <Select
                        value={String(customerForm.priceTable)}
                        onValueChange={(v) => setCustomerForm(f => ({ ...f, priceTable: Number(v) as 1 | 4 | 9 }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Tabela 1 (Atacado)</SelectItem>
                          <SelectItem value="4">Tabela 4 (Varejo)</SelectItem>
                          <SelectItem value="9">Tabela 9 (Atacado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditingCustomer(null)}>Cancelar</Button>
                    <Button onClick={async () => {
                      try {
                        const codigo = customerForm.customerCode.trim();
                        if (codigo) {
                          const dup = (customerProfiles as any[]).find(
                            (c) => String(c.customerCode || '').trim() === codigo && c.id !== editingCustomer.id
                          );
                          if (dup) { toast.error(`Código ${codigo} já usado pelo cliente ${dup.name}.`); return; }
                        }
                        await updateCustomerProfile.mutateAsync({ id: editingCustomer.id, storeId: editingCustomer.storeId, ...customerForm });
                        if (codigo && !editingCustomer.userId) {
                          await createCustomerAccess({ storeId: editingCustomer.storeId, codigo, form: { ...customerForm, customerCode: codigo } });
                          toast.success(`Acesso criado! Código: ${codigo} · Senha: ${initialCodePassword(codigo)}`, { duration: 10000 });
                        } else {
                          toast.success('Cliente atualizado!');
                        }
                        qc.invalidateQueries({ queryKey: ['store-customer-profiles', editingCustomer.storeId] });
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
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1"><Label className="text-sm">Código Vendedor</Label><Input value={customerForm.sellerCode} onChange={e => setCustomerForm(f => ({ ...f, sellerCode: e.target.value }))} placeholder="Ex.: 4" /></div>
                    <div className="grid gap-1"><Label className="text-sm">Transportadora</Label><Input value={customerForm.transportadora} onChange={e => setCustomerForm(f => ({ ...f, transportadora: e.target.value }))} placeholder="Nome da transportadora" /></div>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-sm">Código do Cliente (ERP)</Label>
                    <Input value={customerForm.customerCode} onChange={e => setCustomerForm(f => ({ ...f, customerCode: e.target.value }))} placeholder="Ex.: 98216" />
                    <p className="text-xs text-muted-foreground">Se informado, o acesso é criado automaticamente: login e senha = código.</p>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-sm">Tabela de Preço</Label>
                    <Select
                      value={String(customerForm.priceTable)}
                      onValueChange={(v) => setCustomerForm(f => ({ ...f, priceTable: Number(v) as 1 | 4 | 9 }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Tabela 1 (Atacado)</SelectItem>
                        <SelectItem value="4">Tabela 4 (Varejo)</SelectItem>
                        <SelectItem value="9">Tabela 9 (Atacado)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreatingCustomer(false)}>Cancelar</Button>
                  <Button disabled={!customerForm.name.trim() || createCustomerProfile.isPending} onClick={async () => {
                    try {
                      const codigo = customerForm.customerCode.trim();
                      if (codigo) {
                        const dup = (customerProfiles as any[]).find((c) => String(c.customerCode || '').trim() === codigo);
                        if (dup) { toast.error(`Código ${codigo} já usado pelo cliente ${dup.name}.`); return; }
                        await createCustomerAccess({ storeId: store.id, codigo, form: customerForm });
                        toast.success(`Cliente criado! Login: ${codigo} · Senha: ${initialCodePassword(codigo)}`, { duration: 10000 });
                      } else {
                        await createCustomerProfile.mutateAsync({ storeId: store.id, ...customerForm });
                        toast.success('Cliente criado!');
                      }
                      qc.invalidateQueries({ queryKey: ['store-customer-profiles', store.id] });
                      setCreatingCustomer(false);
                    } catch { toast.error('Erro ao criar cliente'); }
                  }}>
                    {createCustomerProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Reset password dialog */}
            <Dialog open={!!resetPwdCustomer} onOpenChange={(v) => { if (!v) { setResetPwdCustomer(null); setResetPwdValue(''); } }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Redefinir Senha</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <p className="text-sm text-muted-foreground">
                    Defina uma nova senha para <strong>{resetPwdCustomer?.name || 'este cliente'}</strong>.
                    Informe a nova senha ao cliente — ele poderá alterá-la depois.
                  </p>
                  <div className="grid gap-1">
                    <Label className="text-sm">Nova senha (mín. 6 caracteres)</Label>
                    <Input
                      type="text"
                      value={resetPwdValue}
                      onChange={e => setResetPwdValue(e.target.value)}
                      placeholder="ex: cliente123"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setResetPwdCustomer(null); setResetPwdValue(''); }}>
                    Cancelar
                  </Button>
                  <Button
                    disabled={resetPwdValue.length < 6 || resetPwdLoading}
                    onClick={async () => {
                      if (!resetPwdCustomer) return;
                      setResetPwdLoading(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('admin-reset-customer-password', {
                          body: {
                            storeId: resetPwdCustomer.storeId,
                            customerProfileId: resetPwdCustomer.id,
                            newPassword: resetPwdValue,
                          },
                        });
                        if (error) throw error;
                        if ((data as any)?.error) throw new Error((data as any).error);
                        toast.success('Senha redefinida com sucesso!');
                        setResetPwdCustomer(null);
                        setResetPwdValue('');
                      } catch (err: any) {
                        toast.error(err?.message || 'Erro ao redefinir senha');
                      } finally {
                        setResetPwdLoading(false);
                      }
                    }}
                  >
                    {resetPwdLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Salvar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Users (Admin only) */}
          {isAdmin && (
            <TabsContent value="users" className="animate-fade-in">
              <StoreUsersTab storeId={store.id} storeType={store.type as StoreType} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        storeId={store.id}
        categories={categories}
        product={editingProduct}
        storeType={store.type as StoreType}
      />
      <ImportProductsDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        storeId={store.id}
        categories={categories}
        storeType={store.type as StoreType}
      />
      <ImportCustomersDialog
        open={importCustomersOpen}
        onOpenChange={setImportCustomersOpen}
        storeId={store.id}
      />
      <ImportCustomersDialog
        open={updateCustomersOpen}
        onOpenChange={setUpdateCustomersOpen}
        storeId={store.id}
        mode="update"
      />
      <ImportDiscountRulesDialog
        open={importRulesOpen}
        onOpenChange={setImportRulesOpen}
        existingRules={discountRules}
        onImport={async (newRules) => {
          const allRules = [
            ...(store.settings.discountRules || []).filter((r: DiscountRule) => r.type !== 'group'),
            ...newRules,
          ];
          await updateStore.mutateAsync({
            id: store.id,
            settings: { ...store.settings, discountRules: allRules },
          });
          setDiscountRulesLocal(newRules);
        }}
      />
      <ServiceOrderDialog
        open={soDialogOpen}
        onOpenChange={setSODialogOpen}
        serviceOrder={selectedSO}
        storeName={store.name}
        storeWhatsapp={store.whatsapp}
        readOnly={!isAdmin && !permissions.can_manage_service_orders}
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
      <EditOrderDialog
        open={!!editingOrder}
        onOpenChange={(v) => { if (!v) setEditingOrder(null); }}
        order={editingOrder}
        products={products}
        discountRules={store?.settings.discountRules || []}
        categories={categories}
        materialApoio={store?.settings.materialApoio}
        store={store}
        priceTable={(() => {
          if (!editingOrder) return 4;
          const ouid = (editingOrder as any).userId;
          const cleanWa = (editingOrder.customer?.whatsapp || '').replace(/\D/g, '').slice(-8);
          const cp: any = (customerProfiles as any[]).find((c: any) =>
            (ouid && c.userId === ouid) ||
            (cleanWa && (c.whatsapp || '').replace(/\D/g, '').endsWith(cleanWa))
          );
          return (cp?.priceTable === 1 || cp?.priceTable === 9) ? cp.priceTable : 4;
        })()}
      />
      <Dialog open={!!downloadOrder} onOpenChange={(v) => { if (!v) setDownloadOrder(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Baixar Pedido {downloadOrder ? `#${downloadOrder.orderNumber}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1">
              <Label className="text-sm">Formato</Label>
              <Select value={downloadFormat} onValueChange={(v) => setDownloadFormat(v as 'xml' | 'txt')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="xml">XML (Tinturaria)</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Pedido Tele-Vendas</Label>
                <p className="text-xs text-muted-foreground">Marque caso este pedido tenha sido digitado pelo televendas (comissão diferenciada).</p>
              </div>
              <Switch checked={downloadTelevendas} onCheckedChange={setDownloadTelevendas} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDownloadOrder(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!downloadOrder) return;
              const order = downloadOrder;
              const cleanWa = (order.customer.whatsapp || '').replace(/\D/g, '').slice(-8);
              const ouid = (order as any).userId;
              // Pode haver mais de um cadastro para o mesmo telefone (cliente
              // com login por código + login por email). Preferimos sempre o
              // que tem CPF/CNPJ e código do vendedor preenchidos para que o
              // XML do ERP não saia com <cgcCliente></cgcCliente>.
              const candidates = (customerProfiles as any[]).filter((c: any) =>
                (ouid && c.userId === ouid) ||
                (cleanWa && (c.whatsapp || '').replace(/\D/g, '').endsWith(cleanWa))
              );
              const score = (c: any) =>
                (String(c?.cpfCnpj || '').replace(/\D/g, '') ? 4 : 0) +
                (String(c?.customerCode || '').trim() ? 2 : 0) +
                (String(c?.sellerCode || '').trim() ? 1 : 0);
              const cp: any = candidates.sort((a, b) => score(b) - score(a))[0];
              downloadOrderFile(order, store, downloadFormat, {
                cpfCnpj: cp?.cpfCnpj || order.customer.cpfCnpj,
                sellerCode: cp?.sellerCode || '',
                isTelevendas: downloadTelevendas,
                transportadora: cp?.transportadora || '',
                productCommission: Object.fromEntries(
                  products.map(p => {
                    const cat = categories.find(c => c.id === p.categoryId);
                    return [p.id, Number(cat?.commissionPercent) || 0];
                  })
                ),
              });
              setDownloadOrder(null);
            }} className="gap-2">
              <Download className="h-4 w-4" /> Baixar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dicolore: confirmar liberação do pedido para o ERP */}
      <AlertDialog open={!!pendingErpRelease} onOpenChange={(open) => { if (!open) setPendingErpRelease(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar pedido para o ERP</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja liberar o pedido {pendingErpRelease ? `#${pendingErpRelease.orderNumber}` : ''} para o ERP?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={async () => {
                const pending = pendingErpRelease;
                if (!pending) return;
                setPendingErpRelease(null);
                setUpdatingStatusId(pending.orderId);
                try {
                  await updateOrderStatus.mutateAsync({ id: pending.orderId, status: 'liberado_transmissao' });
                  toast.success('Status atualizado!');
                } catch (err: any) {
                  toast.error(err?.message || 'Erro ao atualizar status');
                } finally {
                  setUpdatingStatusId(null);
                }
              }}
            >
              Não
            </Button>
            <AlertDialogAction
              onClick={async () => {
                const pending = pendingErpRelease;
                if (!pending) return;
                setPendingErpRelease(null);
                // IMPORTANTE: abrir o WhatsApp SINCRONICAMENTE, antes de qualquer await.
                // No iOS (Safari/PWA) o gesto do usuário se perde após um await e o
                // window.open é bloqueado silenciosamente. Por isso disparamos a janela
                // primeiro e só depois atualizamos o status do pedido.
                const text = `Olá, o pedido "#${pending.orderNumber}" pode ser transmitido`;
                const waUrl = `https://wa.me/5547992491139?text=${encodeURIComponent(text)}`;
                const waWin = window.open(waUrl, '_blank');
                if (!waWin) {
                  // Fallback (PWA standalone): navega na própria janela
                  window.location.href = waUrl;
                }
                setUpdatingStatusId(pending.orderId);
                try {
                  await updateOrderStatus.mutateAsync({ id: pending.orderId, status: 'liberado_transmissao' });
                  toast.success('Status atualizado!');
                } catch (err: any) {
                  toast.error(err?.message || 'Erro ao atualizar status');
                } finally {
                  setUpdatingStatusId(null);
                }
              }}
            >
              Sim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
