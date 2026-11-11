import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import { effectiveMinOrder } from '@/lib/minOrder';
import { nextFinalizeStep, type FinalizeStep } from '@/lib/finalizeEditFlow';
import { orderPaymentSelection } from '@/lib/orderPaymentSelection';
import { buildOrderPdfFile, deliverOrderPdfFile } from '@/lib/shareOrderPdf';
import { getReleaseIssues } from '@/lib/orderReleaseCheck';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useState, useEffect, useRef } from 'react';
import { hasOpenCustomerDraft } from '@/lib/customerDraft';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle, Loader2, LogIn, Truck, Plus, Minus, X, ShoppingBag } from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useDataVersionSync, ensureLatestDataVersion } from '@/hooks/useDataVersionSync';
import { enqueueOrder, newClientOrderId, isOnline } from '@/lib/offlineQueue';
import { useEditingQuote, setEditingQuote } from '@/lib/quoteEditing';
import EditingQuoteBanner from '@/components/EditingQuoteBanner';
import FinancialAlertBanner from '@/components/FinancialAlertBanner';
import PendingOrdersCard from '@/components/PendingOrdersCard';
import { useCreateOrder } from '@/hooks/useOrders';
import { normalizePriceTable, storeDefaultPriceTable, resolveStorePriceTable, type PriceTable } from '@/lib/pricing';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';
import { useUpsertCustomerProfile } from '@/hooks/useCustomerProfile';
import { useActiveCustomerProfile } from '@/hooks/useActiveCustomerProfile';
import SellerCustomerDialog from '@/components/SellerCustomerDialog';
import { useStoreSellers } from '@/hooks/useStoreSellers';
import { useOrderRecipients } from '@/hooks/useOrderRecipients';
import { useCart } from '@/contexts/CartContext';
import { computeGroupDiscounts } from '@/lib/groupDiscounts';
import { useProducts } from '@/hooks/useProducts';
import { wouldExceedMaterialApoio, MATERIAL_APOIO_MSG } from '@/lib/materialApoio';
import { expandKitItems } from '@/lib/kitExpansion';
import { useStoreKitMap } from '@/hooks/useProductKits';
import {
  formatCurrency, formatCPFCNPJ, formatPhone, formatCEP,
  generateWhatsAppMessage, describeShipping, buildWhatsAppUrl, downloadTxt,
} from '@/lib/formatters';
import { fetchAddressByCep } from '@/lib/cepLookup';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import QuantityStepper from '@/components/QuantityStepper';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ClosedBanner from '@/components/ClosedBanner';
import { useStoreOpen } from '@/hooks/useStoreOpen';
import type { PaymentMethod, DeliveryShift } from '@/types';
import { getStoreFormas, getStoreCondicoes, isDicoloreFlow } from '@/lib/dicolorePayments';
import MabelleEmbeddedCheckout from '@/components/MabelleEmbeddedCheckout';
import { PaymentTestModeBanner } from '@/components/PaymentTestModeBanner';
import { PixPaymentDialog, type PixDialogData } from '@/components/PixPaymentDialog';
import { getPaymentGateway } from '@/components/PaymentSettingsCard';
import { getAvailablePaymentMethods } from '@/lib/paymentAvailability';
import { buildPixPayload } from '@/lib/pixBrCode';
import { getSuperfreteCustomerError } from '@/lib/superfreteCustomer';
import { getCustomerError } from '@/lib/customerValidation';
import { customerDataIsReadOnly } from '@/lib/customerDataAccess';

interface ShippingOption {
  code: string;
  name: string;
  price: number;
  deadline: number;
  error?: string;
}

const brazilianStates = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  useDataVersionSync(slug, store?.id);
  const createOrder = useCreateOrder();
  const { data: allProductsCk = [] } = useProducts(store?.id);
  const editingQuote = useEditingQuote(store?.id);
  const { cart, clearCart, itemDiscounts, discountRules, updateQuantity, removeItem, setStoreId } = useCart();
  useEffect(() => { if (store?.id) setStoreId(store.id); }, [store?.id, setStoreId]);
  const { user, loading: authLoading } = useAuth();
  const {
    profile: customerProfile,
    isSellerMode,
    selectedCustomer,
    selectCustomer,
    clearSelectedCustomer,
    seller,
  } = useActiveCustomerProfile(store?.id);
  const sellerOrder = isSellerMode && !!selectedCustomer;
  const { data: savedAddresses = [] } = useCustomerAddresses(user?.id, store?.id, store?.slug);
  const lockedCustomerData = customerDataIsReadOnly(store?.slug, isSellerMode);
  const canOfferRelease = sellerOrder && (seller.isSeller || seller.isTelevendas);
  const { data: sellers = [] } = useStoreSellers(store?.id);
  // Tabela de preço que prevalece em todo o pedido: a do cadastro do cliente,
  // com o padrão da loja como único fallback (mesma regra da vitrine).
  const activePriceTable: PriceTable = resolveStorePriceTable(store?.slug, customerProfile?.priceTable);
  const { data: kitMap = {} } = useStoreKitMap(store?.id, activePriceTable);
  const { data: recipientsRpc = [] } = useOrderRecipients(store?.id, customerProfile?.sellerCode);
  // If customer has a linked seller, restrict the dropdown to that seller + any televendas linked to them.
  // Otherwise fall back to all active sellers.
  const recipientOptions = (customerProfile?.sellerCode && recipientsRpc.length > 0)
    ? recipientsRpc.map(r => ({ id: r.id, name: r.name, whatsapp: r.whatsapp, kind: r.kind }))
    : sellers.map(s => ({ id: s.id, name: s.name, whatsapp: s.whatsapp, kind: 'vendedor' as const }));
  const upsertProfile = useUpsertCustomerProfile();
  const storeOpenStatus = useStoreOpen(store);
  const dicolore = isDicoloreFlow(store?.slug, store?.settings);
  const { hasAccess: dicoloreStaff } = useStoreAdmin(dicolore ? store?.id : undefined);
  const formas = getStoreFormas(store?.settings).filter(f => f.ativo);
  const condicoes = getStoreCondicoes(store?.settings).filter(c => c.ativo);
  const availablePaymentMethods = getAvailablePaymentMethods(store?.settings);

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
    paymentMethod: 'pix' as PaymentMethod,
    deliveryShift: 'tarde' as DeliveryShift,
    observations: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{ url: string; sellerName: string } | null>(null);
  const [pixDialog, setPixDialog] = useState<PixDialogData | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [sellerCustomerDialogOpen, setSellerCustomerDialogOpen] = useState(false);
  useEffect(() => {
    if (hasOpenCustomerDraft(store?.id)) setSellerCustomerDialogOpen(true);
  }, [store?.id]);
  const [onlineCheckout, setOnlineCheckout] = useState<any>(null);

  // Se a loja desativar uma forma de pagamento, não mantém uma escolha antiga
  // escondida no formulário nem permite enviá-la ao finalizar.
  useEffect(() => {
    if (dicolore || availablePaymentMethods.includes(formData.paymentMethod)) return;
    const fallback = availablePaymentMethods[0];
    if (fallback) setFormData(prev => ({ ...prev, paymentMethod: fallback }));
  }, [dicolore, formData.paymentMethod, store?.settings]);

  // Dicolore ERP payment codes
  const [finalizeAsk, setFinalizeAsk] = useState<FinalizeStep | null>(null);
  // Cliente PROSPECT sem CPF/CNPJ: 'ask' -> 'edit' -> 'finish'.
  const [prospectStep, setProspectStep] = useState<null | 'ask' | 'edit' | 'finish'>(null);
  const [prospectForm, setProspectForm] = useState({ cpfCnpj: '', name: '', whatsapp: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '' });
  const [prospectSaving, setProspectSaving] = useState(false);
  const [releaseConfirm, setReleaseConfirm] = useState(false);
  const [paymentFormaCodigo, setPaymentFormaCodigo] = useState<string>('');
  const [paymentCondicaoCodigo, setPaymentCondicaoCodigo] = useState<string>('');
  const [paymentOrderId, setPaymentOrderId] = useState<string | null>(null);
  const [paymentRestoreError, setPaymentRestoreError] = useState(false);
  const restoringPayment = !!editingQuote && paymentOrderId !== editingQuote.id;

  // Read the persisted choice for every edit entrypoint, including page reloads.
  useEffect(() => {
    if (!editingQuote?.id || !store?.id) return;
    let cancelled = false;
    setPaymentRestoreError(false);
    supabase.from('orders').select('customer,payment_method,delivery_shift,observations')
      .eq('id', editingQuote.id).eq('store_id', store.id).single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setPaymentRestoreError(true);
          toast.error('Não foi possível recuperar o pagamento do pedido. Reabra a edição.');
          return;
        }
        const saved = orderPaymentSelection(data.customer);
        setPaymentFormaCodigo(saved.formaCodigo);
        setPaymentCondicaoCodigo(saved.condicaoCodigo);
        setFormData(prev => ({ ...prev,
          paymentMethod: data.payment_method as PaymentMethod,
          deliveryShift: data.delivery_shift as DeliveryShift,
          observations: data.observations || '',
        }));
        setPaymentOrderId(editingQuote.id);
      });
    return () => { cancelled = true; };
  }, [editingQuote?.id, store?.id]);

  // Shipping state
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingQuoted, setShippingQuoted] = useState(false);

  // Delivery type (COMIDA/PIZZARIA)
  const [deliveryType, setDeliveryType] = useState<'entrega' | 'retirada'>('entrega');
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>('');
  // Endereço diferente do cadastro, só para este pedido
  const [useOtherAddress, setUseOtherAddress] = useState(false);

  // Auto-fill from customer profile
  useEffect(() => {
    if (customerProfile && !profileLoaded) {
      setFormData(prev => ({
        ...prev,
        name: customerProfile.name || prev.name,
        cpfCnpj: customerProfile.cpfCnpj || prev.cpfCnpj,
        whatsapp: customerProfile.whatsapp || prev.whatsapp,
        cep: customerProfile.cep || prev.cep,
        uf: customerProfile.uf || prev.uf,
        city: customerProfile.city || prev.city,
        neighborhood: customerProfile.neighborhood || prev.neighborhood,
        address: customerProfile.address || prev.address,
        number: customerProfile.number || prev.number,
        complement: customerProfile.complement || prev.complement,
      }));
      setUseOtherAddress(!(customerProfile.cep && customerProfile.address));
      setProfileLoaded(true);
    }
  }, [customerProfile, profileLoaded]);

  const restoreProfileAddress = () => {
    if (!customerProfile) return;
    setFormData(prev => ({
      ...prev,
      cep: customerProfile.cep || '', uf: customerProfile.uf || '', city: customerProfile.city || '',
      neighborhood: customerProfile.neighborhood || '', address: customerProfile.address || '',
      number: customerProfile.number || '', complement: customerProfile.complement || '',
    }));
    setUseOtherAddress(false);
  };

  // Ao trocar o cliente no Modo Vendedor, recarrega os dados no formulário
  useEffect(() => {
    setProfileLoaded(false);
  }, [selectedCustomer?.id]);

  // Auto-select the only available recipient (e.g. customer has just one linked seller)
  useEffect(() => {
    if (!selectedSellerId && recipientOptions.length === 1) {
      setSelectedSellerId(recipientOptions[0].id);
    }
  }, [recipientOptions, selectedSellerId]);

  // "Salvar Orçamento" acionado direto da gaveta do carrinho
  const autoQuoteRef = useRef<{ done: boolean; run?: () => void }>({ done: false });
  useEffect(() => {
    if (autoQuoteRef.current.done) return;
    if (!new URLSearchParams(window.location.search).has('salvarOrcamento')) return;
    if (!profileLoaded || !formData.name || cart.items.length === 0 || !autoQuoteRef.current.run) return;
    autoQuoteRef.current.done = true;
    const t = setTimeout(() => autoQuoteRef.current.run?.(), 300);
    return () => clearTimeout(t);
  });

  // CEP já preenchido pelo cadastro: calcula o frete automaticamente.
  const autoShipRef = useRef<{ cep: string; enabled: boolean; run?: (cep: string) => void }>({ cep: '', enabled: false });
  const cepDigits = (formData.cep || '').replace(/\D/g, '');
  useEffect(() => {
    const s = autoShipRef.current;
    if (!s.enabled || !s.run || cepDigits.length !== 8 || s.cep === cepDigits) return;
    s.cep = cepDigits;
    s.run(cepDigits);
  });

  if (storeLoading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Carrinho vazio</h1>
          <p className="text-muted-foreground">Adicione produtos antes de finalizar</p>
          <Button asChild className="mt-4"><Link to={`/${store.slug}`}>Voltar à loja</Link></Button>
        </div>
      </div>
    );
  }

  // If not logged in, show login prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card">
          <div className="container flex h-14 items-center gap-4">
            <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
            <h1 className="font-bold">Finalizar Pedido</h1>
          </div>
        </header>
        <main className="container py-12">
          <div className="mx-auto max-w-md text-center">
            <LogIn className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h2 className="mt-6 text-2xl font-bold">Faça login para continuar</h2>
            <p className="mt-2 text-muted-foreground">Para finalizar seu pedido, é necessário estar logado. Assim seus dados ficam salvos para compras futuras.</p>
            <Button className="mt-6 w-full" size="lg" onClick={() => setAuthDialogOpen(true)}>
              <LogIn className="mr-2 h-5 w-5" /> Entrar ou Cadastrar
            </Button>
          </div>
        </main>
        <CustomerAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} storeId={store.id} storeSlug={store.slug} allowSignup={store.settings?.allowCustomerSignup !== false} requireApproval={(store.settings as any)?.requireLoginToBrowse === true} />
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    if (lockedCustomerData && ['name', 'cpfCnpj', 'whatsapp', 'cep', 'uf', 'city', 'neighborhood', 'address', 'number', 'complement'].includes(field)) return;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!dicolore && !availablePaymentMethods.includes(formData.paymentMethod)) {
      toast.error(availablePaymentMethods.length
        ? 'A forma de pagamento escolhida foi desativada pela loja. Selecione outra opção.'
        : 'A loja não possui uma forma de pagamento disponível no momento.');
      return false;
    }
    if (restoringPayment || paymentRestoreError) {
      toast.error(paymentRestoreError ? 'Reabra a edição para recuperar o pagamento salvo.' : 'Aguarde o carregamento do pagamento salvo.');
      return false;
    }
    // Evita a "janela de corrida": se ainda estamos verificando se o usuário é
    // vendedor da loja, não deixa finalizar (senão o pedido sairia no nome dele).
    if (seller.loading) {
      toast.error('Aguarde a verificação do seu acesso e tente novamente');
      return false;
    }
    // DiColore: pedido só é finalizado por vendedor, televendas ou admin — nunca pelo cliente.
    if (dicolore && !isSellerMode && !dicoloreStaff) {
      toast.error('Pedidos na DiColore são finalizados pelo seu representante. Entre em contato com seu vendedor.');
      return false;
    }
    if (dicolore && isSellerMode && !selectedCustomer) {
      toast.error('Selecione o cliente antes de finalizar o pedido');
      return false;
    }

    if (offersDelivery && hasNeighborhoods && deliveryType === 'entrega' && !selectedNeighborhoodId) {
      toast.error('Selecione o bairro de entrega');
      return false;
    }
    if (dicolore) {
      const doc = String(formData.cpfCnpj || '').replace(/\D/g, '');
      if (doc.length !== 11 && doc.length !== 14) {
        if (sellerOrder && selectedCustomer && !String(selectedCustomer.customerCode || '').trim()) {
          setProspectForm({
            cpfCnpj: formData.cpfCnpj || '', name: formData.name || '', whatsapp: formData.whatsapp || '',
            cep: formData.cep || '', uf: formData.uf || '', city: formData.city || '',
            neighborhood: formData.neighborhood || '', address: formData.address || '', number: formData.number || '',
          });
          setProspectStep('ask');
          return false;
        }
        toast.error('Informe o CPF/CNPJ do cliente para finalizar o pedido');
        return false;
      }
    }
    if (recipientOptions.length > 0 && !sellerOrder && !selectedSellerId) {
      toast.error('Selecione o vendedor para enviar o pedido');
      return false;
    }
    if (offersDelivery && !isPickupSel && shippingEnabled && shippingOptions.length > 0 && !selectedShipping) {
      toast.error('Selecione a modalidade de frete');
      return false;
    }
    const customerError = getCustomerError(formData, { pickup: !offersDelivery || deliveryType === 'retirada' });
    if (customerError) {
      if (!lockedCustomerData) setUseOtherAddress(true);
      toast.error(lockedCustomerData ? 'Seu cadastro precisa ser corrigido pela loja. Entre em contato com seu representante.' : customerError);
      return false;
    }
    const superfreteCustomerError = getSuperfreteCustomerError(formData, selectedShipping);
    if (superfreteCustomerError) {
      toast.error(superfreteCustomerError);
      return false;
    }
    return true;
  };

  const offersDelivery = store ? (store.settings?.offersDelivery !== false) : true;
  const shippingEnabled = !!(offersDelivery && store && (store.type === 'LOJA' || store.type === 'ACESSORIOS') && store.settings.shipping?.enabled);
  const selectedShippingOption = shippingOptions.find(o => o.code === selectedShipping);
  const shippingFee = selectedShippingOption?.price || 0;

  const neighborhoods = (store?.settings as any)?.deliveryNeighborhoods as { id: string; name: string; fee: number }[] | undefined;
  const hasNeighborhoods = !!offersDelivery && !!neighborhoods && neighborhoods.length > 0
    && (store?.type === 'COMIDA' || store?.type === 'PIZZARIA');
  const selectedNeighborhood = hasNeighborhoods
    ? neighborhoods!.find(n => n.id === selectedNeighborhoodId)
    : undefined;

  const isPickupSel = offersDelivery && deliveryType === 'retirada';
  let deliveryFee = 0;
  if (!offersDelivery || isPickupSel) {
    deliveryFee = 0;
  } else if (shippingEnabled) {
    deliveryFee = shippingFee;
  } else if (hasNeighborhoods) {
    deliveryFee = deliveryType === 'entrega' ? (selectedNeighborhood?.fee || 0) : 0;
  } else {
    deliveryFee = store?.settings.deliveryFee || 0;
  }

  const totalDiscount = cart.couponDiscount + cart.quantityDiscount;
  const totalWithDelivery = cart.total + deliveryFee;

  const fetchShippingQuote = async (destinyCep: string) => {
    if (!store || !shippingEnabled || !store.settings.shipping) return;
    const shipping = store.settings.shipping;
    if (!shipping.originCep) return;

    setShippingLoading(true);
    setShippingOptions([]);
    setSelectedShipping('');
    setShippingQuoted(false);

    try {
      const { data, error } = await supabase.functions.invoke('correios-shipping', {
        body: {
          storeId: store.id,
          originCep: shipping.originCep,
          destinyCep,
          weight: shipping.defaultWeight,
          length: shipping.defaultLength,
          width: shipping.defaultWidth,
          height: shipping.defaultHeight,
          services: shipping.enabledServices,
        },
      });

      if (error) throw error;

      const validOptions = (data.options as ShippingOption[]).filter(o => !o.error && o.price > 0);
      setShippingOptions(validOptions);
      if (validOptions.length === 1) {
        setSelectedShipping(validOptions[0].code);
      }
      setShippingQuoted(true);

      if (validOptions.length === 0) {
        toast.error('Não foi possível calcular o frete para este CEP');
      }
    } catch {
      toast.error('Erro ao calcular frete');
    }
    setShippingLoading(false);
  };

  autoShipRef.current.enabled = shippingEnabled;
  autoShipRef.current.run = fetchShippingQuote;

  const generateOrderMessage = () => {
    const { quantityDiscount: liveQtyDiscount, itemDiscounts: liveItemDiscounts } =
      computeGroupDiscounts(cart.items, discountRules, activePriceTable);
    const ship = describeShipping({ shippingService: selectedShippingOption?.name, shippingDeadline: selectedShippingOption?.deadline, deliveryFee, isPickup: isPickupSel });
    return generateWhatsAppMessage({
      shippingLabel: ship?.label, shippingName: ship?.name, deliveryFee,
      storeName: store.name,
      customer: {
        name: formData.name, cpfCnpj: formData.cpfCnpj, whatsapp: formData.whatsapp,
        address: `${formData.address}, ${formData.number}`,
        neighborhood: formData.neighborhood, city: formData.city, uf: formData.uf, cep: formData.cep,
      },
      items: expandKitItems(
        cart.items.map(item => ({
          ...item,
          discountPercent:
            liveItemDiscounts[`${item.productId}-${item.variantId || ''}`] ||
            itemDiscounts[`${item.productId}-${item.variantId || ''}`] ||
            0,
        })) as any,
        kitMap,
      ).map((item: any) => ({
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        discountPercent: item.discountPercent || 0,
      })),
      subtotal: cart.subtotal,
      discount: cart.couponDiscount + liveQtyDiscount,
      total: totalWithDelivery,
      paymentMethod: formData.paymentMethod,
      deliveryShift: formData.deliveryShift,
    });
  };

  const handleDownloadTxt = () => {
    if (!validateForm()) return;
    downloadTxt(generateOrderMessage(), `pedido_${store.slug}_${Date.now()}.txt`);
    toast.success('Arquivo baixado!');
  };

  const handleDownloadPdf = () => {
    try {
      const { quantityDiscount, itemDiscounts: currentDiscounts } = computeGroupDiscounts(cart.items, discountRules, activePriceTable);
      const discount = cart.couponDiscount + quantityDiscount;
      const file = buildOrderPdfFile({
        status: 'orcamento', created_at: new Date().toISOString(),
        customer: { ...formData, customerCode: customerProfile?.customerCode,
          paymentFormaCodigo, paymentCondicaoCodigo,
          paymentFormaDescricao: formas.find(f => f.codigo === paymentFormaCodigo)?.descricao,
          paymentCondicaoDescricao: condicoes.find(c => c.codigo === paymentCondicaoCodigo)?.descricao,
        },
        items: expandKitItems(cart.items.map(item => ({ ...item,
          discountPercent: currentDiscounts[`${item.productId}-${item.variantId || ''}`] || 0,
        })), kitMap),
        subtotal: cart.subtotal, discount, delivery_fee: deliveryFee,
        shipping_service: isPickupSel ? 'Retirada na loja' : selectedShippingOption?.name,
        shipping_deadline: selectedShippingOption?.deadline,
        total: Math.max(0, cart.subtotal - discount) + deliveryFee,
        payment_method: formData.paymentMethod, observations: formData.observations,
      }, store.name);
      void deliverOrderPdfFile(file).catch(() => toast.error('Não foi possível baixar o PDF.'));
    } catch {
      toast.error('Não foi possível gerar o PDF.');
    }
  };

  const saveProspect = async () => {
    const f = prospectForm;
    const customerError = getCustomerError(f);
    if (customerError) { toast.error(customerError); return; }
    if (!selectedCustomer?.id) return;
    setProspectSaving(true);
    try {
      const { error } = await supabase.from('customer_profiles').update({
        cpf_cnpj: f.cpfCnpj, name: f.name.trim().toUpperCase(), whatsapp: f.whatsapp, cep: f.cep, uf: f.uf,
        city: f.city, neighborhood: f.neighborhood, address: f.address, number: f.number,
      }).eq('id', selectedCustomer.id).select().single();
      if (error) throw error;
      selectCustomer({ ...selectedCustomer, ...f, name: f.name.trim().toUpperCase() } as any);
      setFormData(prev => ({ ...prev, ...f, name: f.name.trim().toUpperCase() }));
      setProspectStep('finish');
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível salvar o cliente');
    } finally {
      setProspectSaving(false);
    }
  };

  const handleSendWhatsApp = async (asQuote = false, opts: { decided?: boolean; release?: boolean } = {}) => {
    if (!validateForm()) return;
    if (!opts.decided) {
      const step = nextFinalizeStep({
        storeSlug: store?.slug, isEditing: !!editingQuote, sellerOrder: canOfferRelease, asQuote,
        formaCodigo: paymentFormaCodigo, condicaoCodigo: paymentCondicaoCodigo,
      });
      if (step !== 'save') { setReleaseConfirm(false); setFinalizeAsk(step); return; }
    }
    // Nenhum item pode ser fechado sem preço válido na tabela do cliente.
    if (cart.items.some(i => !(Number(i.price) > 0))) {
      toast.error('Alguns itens não têm preço para a sua tabela. Remova-os para continuar.');
      return;
    }
    if (!storeOpenStatus.open) {
      toast.error(`Loja fechada${storeOpenStatus.message ? ` — ${storeOpenStatus.message}` : ''}. Pedidos só dentro do horário.`);
      return;
    }
    const minOrder = effectiveMinOrder(store, !!isSellerMode);
    const effectiveTotal = cart.subtotal - (cart.quantityDiscount || 0);
    if (minOrder > 0 && effectiveTotal < minOrder) {
      toast.error(`Pedido mínimo de ${formatCurrency(minOrder)}. Faltam ${formatCurrency(minOrder - effectiveTotal)} em produtos (já considerando descontos).`);
      return;
    }
    // Abre a aba do WhatsApp já no gesto do usuário para não ser bloqueada
    // pelo navegador (a URL é definida depois que o pedido é gravado).
    const isOnlinePayment = store.slug === 'mabelle' && store.settings.onlinePayments === true
      && (formData.paymentMethod === 'pix' || formData.paymentMethod === 'cartao');
    const gateway = getPaymentGateway(store.settings);
    const useMp = !sellerOrder && !isOnlinePayment && gateway.provider === 'mercadopago' && ((gateway.pixEnabled && formData.paymentMethod === 'pix') || (gateway.cardEnabled && formData.paymentMethod === 'cartao'));
    const usePixQr = !useMp && !sellerOrder && !isOnlinePayment && gateway.pixEnabled && !!gateway.pixKey && formData.paymentMethod === 'pix';
    const awaitsPayment = !sellerOrder && !isOnlinePayment && ((gateway.pixEnabled && formData.paymentMethod === 'pix') || (gateway.cardEnabled && formData.paymentMethod === 'cartao'));
    const waWindow = sellerOrder || isOnlinePayment || usePixQr || useMp ? null : window.open('', '_blank');
    setIsSubmitting(true);
    try {
      const offline = !isOnline();
      if (isOnlinePayment && offline) {
        toast.error('Conecte-se à internet para realizar o pagamento.');
        return;
      }
      // Bloqueia a finalização se o catálogo/preços foram atualizados pela loja
      // enquanto o cliente estava com o navegador aberto.
      if (!offline && slug && store?.id) {
        const wasStale = await ensureLatestDataVersion(slug, store.id);
        if (wasStale) {
          toast.error('Os preços foram atualizados pela loja. Revise seu pedido antes de finalizar.');
          setIsSubmitting(false);
          // Força recarregar a página para puxar preços novos do catálogo
          setTimeout(() => window.location.reload(), 1200);
          return;
        }
      }
      // Recalcula descontos por grupo na hora, evitando estado defasado do contexto
      const { quantityDiscount: liveQtyDiscount, itemDiscounts: liveItemDiscounts } =
        computeGroupDiscounts(cart.items, discountRules, activePriceTable);
      const liveTotalDiscount = cart.couponDiscount + liveQtyDiscount;
      const liveTotal = Math.max(0, cart.subtotal - liveTotalDiscount) + deliveryFee;
      const isPickup = isPickupSel || !offersDelivery;
      const observationsFinal = [
        !offersDelivery ? '' : (isPickup ? '[RETIRAR NA LOJA]' : (selectedNeighborhood ? `[ENTREGA: ${selectedNeighborhood.name}]` : '')),
        formData.observations || '',
      ].filter(Boolean).join(' ').trim();

      // Save/update customer profile (sempre, mesmo em retirada — preserva cliente em Clientes).
      // No Modo Vendedor não sobrescrevemos o cadastro do cliente escolhido.
      if (!sellerOrder && !lockedCustomerData && !offline) try {
        await upsertProfile.mutateAsync({
          userId: user.id,
          storeId: store.id,
          name: formData.name,
          cpfCnpj: formData.cpfCnpj,
          whatsapp: formData.whatsapp,
          ...((isPickup || useOtherAddress) && customerProfile ? {
            cep: customerProfile.cep || '', uf: customerProfile.uf || '', city: customerProfile.city || '',
            neighborhood: customerProfile.neighborhood || '', address: customerProfile.address || '',
            number: customerProfile.number || '', complement: customerProfile.complement || undefined,
          } : {
            cep: formData.cep, uf: formData.uf, city: formData.city, neighborhood: formData.neighborhood,
            address: formData.address, number: formData.number, complement: formData.complement || undefined,
          }),
        });
      } catch (profileErr: any) {
        // Não bloqueia o pedido, mas o usuário precisa saber que o cadastro não foi salvo
        console.warn('[checkout] upsertProfile falhou:', profileErr);
        toast.warning(
          `Não foi possível salvar seu cadastro de cliente: ${profileErr?.message || 'erro desconhecido'}. O pedido segue normalmente, mas avise a loja.`,
          { duration: 8000 },
        );
      }


      const orderPayload: any = {
        storeId: store.id,
        customer: {
          name: formData.name, cpfCnpj: formData.cpfCnpj, whatsapp: formData.whatsapp,
          cep: isPickup ? '' : formData.cep, uf: isPickup ? '' : formData.uf, city: isPickup ? '' : formData.city,
          neighborhood: isPickup ? 'RETIRAR NA LOJA' : formData.neighborhood,
          address: isPickup ? 'RETIRAR NA LOJA' : formData.address,
          number: isPickup ? '' : formData.number,
          complement: isPickup ? '' : formData.complement,
          priceTable: activePriceTable,
          ...(!sellerOrder && customerProfile ? {
            sellerCode: (customerProfile as any)?.sellerCode ? String((customerProfile as any).sellerCode) : undefined,
            customerCode: (customerProfile as any)?.customerCode || undefined,
            ie: (customerProfile as any)?.ie || undefined,
            transportadora: (customerProfile as any)?.transportadora || undefined,
          } : {}),
          ...(user?.email ? { createdByUserEmail: user.email } : {}),
          ...(seller.sellerName ? {
            createdByName: seller.sellerName,
            createdByRole: seller.isTelevendas ? 'televendas' : (seller.isSeller ? 'vendedor' : undefined),
            ownerRole: seller.isTelevendas ? 'televendas' : (seller.isSeller ? 'vendedor' : undefined),
            ownerName: seller.sellerName,
            ...(seller.isSeller && !seller.isTelevendas && seller.sellerCodes?.[0] ? { sellerCode: String(seller.sellerCodes[0]) } : {}),
          } : (!sellerOrder ? { createdByName: formData.name, createdByRole: 'cliente' } : {})),
          ...(seller.isTelevendas ? { isTelevendas: true, televendasName: seller.sellerName || undefined, televendasErpCode: seller.erpCode || undefined } : {}),
          ...(() => {
            if (seller.sellerName || sellerOrder) return {};
            const r = selectedSellerId ? recipientOptions.find(s => s.id === selectedSellerId) : undefined;
            if (!r) return {};
            return r.kind === 'televendas'
              ? { ownerRole: 'televendas', ownerName: r.name, isTelevendas: true, televendasName: r.name, televendasErpCode: (r as any).code || undefined }
              : { ownerRole: 'vendedor', ownerName: r.name };
          })(),
          ...(sellerOrder ? {
            customerCode: selectedCustomer?.customerCode || undefined,
            sellerCode: selectedCustomer?.sellerCode || undefined,
            ie: selectedCustomer?.ie || undefined,
            transportadora: selectedCustomer?.transportadora || undefined,
            sellerUserName: seller.sellerName || undefined,
          } : {}),
          ...(dicolore ? {
            paymentFormaCodigo: paymentFormaCodigo || undefined,
            paymentFormaDescricao: formas.find(f => f.codigo === paymentFormaCodigo)?.descricao,
            paymentCondicaoCodigo: paymentCondicaoCodigo || undefined,
            paymentCondicaoDescricao: condicoes.find(c => c.codigo === paymentCondicaoCodigo)?.descricao,
          } : {}),
        },
        items: cart.items.map(item => ({
          ...item,
          discountPercent:
            liveItemDiscounts[`${item.productId}-${item.variantId || ''}`] ||
            itemDiscounts[`${item.productId}-${item.variantId || ''}`] ||
            undefined,
        })),
        subtotal: cart.subtotal,
        discount: liveTotalDiscount,
        deliveryFee,
        total: liveTotal,
        paymentMethod: formData.paymentMethod,
        deliveryShift: formData.deliveryShift,
        observations: observationsFinal || undefined,
        status: asQuote ? 'orcamento' : 'pendente',
        ...(sellerOrder ? { origem: 'vendedor' } : {}),
        shippingService: selectedShippingOption?.name,
        shippingCode: selectedShippingOption?.code,
        shippingDeadline: selectedShippingOption?.deadline,
        ...(awaitsPayment && !asQuote ? { paymentStatus: 'pending' as const } : {}),
      };

      if (isOnlinePayment) {
        setOnlineCheckout({
          storeId: store.id,
          customer: orderPayload.customer,
          items: orderPayload.items,
          paymentMethod: formData.paymentMethod,
          deliveryShift: formData.deliveryShift,
          observations: observationsFinal || undefined,
          shipping: selectedShippingOption,
        });
        return;
      }

      if (editingQuote && (sellerOrder || editingQuote.byCustomer)) {
        if (offline) throw new Error('Sem internet: conecte-se para salvar a edição do orçamento');
        const { data: { user: editingUser }, error: editingAuthError } = await supabase.auth.getUser();
        if (editingAuthError || !editingUser) throw new Error('Entre novamente para salvar o pedido.');
        waWindow?.close();
        const byCustomer = !sellerOrder && !!editingQuote.byCustomer;
        const { error: upErr } = await supabase.from('orders').update({
          customer: orderPayload.customer as any,
          items: orderPayload.items as any,
          subtotal: orderPayload.subtotal,
          discount: orderPayload.discount,
          delivery_fee: orderPayload.deliveryFee,
          total: orderPayload.total,
          payment_method: orderPayload.paymentMethod,
          delivery_shift: orderPayload.deliveryShift,
          observations: orderPayload.observations ?? null,
          status: asQuote && !byCustomer ? 'orcamento' : 'pendente',
        }).eq('id', editingQuote.id).select().single();
        if (upErr) throw upErr;
        setEditingQuote(null);
        let released = false;
        if (opts.release && canOfferRelease && !asQuote && store.slug === 'dicolore') {
          const issues = getReleaseIssues({ customer: orderPayload.customer, items: orderPayload.items as any });
          if (issues.length) {
            toast.error(`Pedido salvo como Pendente. Complete: ${issues.join('; ')}`, { duration: 8000 });
          } else {
            const { error: relErr } = await supabase.from('orders').update({ status: 'liberado_transmissao' }).eq('id', editingQuote.id).select().single();
            if (relErr) toast.error(`Pedido salvo como Pendente. Não foi possível liberar: ${relErr.message}`, { duration: 8000 });
            else released = true;
          }
        }
        if (opts.decided && !opts.release && !asQuote && (!paymentFormaCodigo || !paymentCondicaoCodigo) && store.slug === 'dicolore') {
          toast.warning('O pedido só será transmitido com a Condição e a Forma de pagamento selecionadas.', { duration: 8000 });
        }
        toast.success(released ? `Pedido salvo e liberado para transmissão` : byCustomer ? 'Pedido corrigido e reenviado à empresa' : asQuote ? `Orçamento atualizado para ${formData.name}` : `Pedido salvo como Pendente para ${formData.name}`);
        setTimeout(() => { clearCart(); if (sellerOrder) clearSelectedCustomer(); navigate(byCustomer ? `/${store.slug}/pedidos` : `/${store.slug}/vendedor/vendas`); }, 1200);
        return;
      }

      if (offline) {
        waWindow?.close();
        await enqueueOrder({
          id: newClientOrderId(),
          storeId: store.id,
          storeSlug: store.slug,
          customerName: formData.name,
          total: liveTotal,
          payload: orderPayload,
        });
        if (asQuote) {
          toast.success('Orçamento salvo no dispositivo');
          setTimeout(() => { clearCart(); if (sellerOrder) clearSelectedCustomer(); navigate(sellerOrder ? `/${store.slug}/vendedor/vendas` : `/${store.slug}`); }, 1000);
        } else {
          setOfflineSaved(true);
        }
        return;
      }

      const created: any = await createOrder.mutateAsync(orderPayload);

      let createdReleased = false;
      if (opts.release && canOfferRelease && !asQuote && store.slug === 'dicolore' && created?.id) {
        const issues = getReleaseIssues({ customer: orderPayload.customer, items: orderPayload.items });
        if (issues.length) {
          toast.error(`Pedido salvo como Pendente. Complete: ${issues.join('; ')}`, { duration: 8000 });
        } else {
          const { error } = await supabase.from('orders').update({ status: 'liberado_transmissao' })
            .eq('id', created.id).eq('store_id', store.id).select().single();
          if (error) toast.error(`Pedido salvo como Pendente. Não foi possível liberar: ${error.message}`, { duration: 8000 });
          else createdReleased = true;
        }
      }

      if (!asQuote && created?.id && String(orderPayload.shippingCode || '').startsWith('SF-')) {
        supabase.functions.invoke('superfrete-label', { body: { action: 'create', orderId: created.id } }).catch(() => {});
      }

      if (sellerOrder) {
        const storeName = store.name;
        toast.success(createdReleased ? 'Pedido salvo e liberado para transmissão' : asQuote ? `Orçamento salvo para ${formData.name}` : `Pedido registrado para ${formData.name}`, {
          duration: 15000,
          action: created?.id ? {
            label: 'Enviar PDF',
            onClick: () => {
              import('@/lib/shareOrderPdf').then(m => m.shareOrderPdf(created.id, storeName))
                .catch((e: any) => toast.error(e?.message || 'Não foi possível gerar o PDF'));
            },
          } : undefined,
        });
        setTimeout(() => { clearCart(); clearSelectedCustomer(); navigate(`/${store.slug}`); }, 1200);
        return;
      }

      const chosenRecipient = recipientOptions.length > 0 && selectedSellerId
        ? recipientOptions.find(s => s.id === selectedSellerId)
        : undefined;
      const targetWhatsapp = chosenRecipient?.whatsapp || store.whatsapp;
      const waUrl = buildWhatsAppUrl(targetWhatsapp, generateOrderMessage());

      if (useMp && !asQuote && created?.id) {
        const method = formData.paymentMethod === 'pix' ? 'pix' : 'card';
        const { data: mpr, error: mpe } = await supabase.functions.invoke('mercadopago', { body: { action: 'create', orderId: created.id, method } });
        if (mpe || mpr?.error) throw new Error(mpr?.error || 'Não foi possível gerar o pagamento. O pedido foi salvo; fale com a loja.');
        if (method === 'pix') {
          setPixDialog({ payload: mpr.qrCode, qrImage: mpr.qrCodeBase64, amount: mpr.amount, orderNumber: created?.order_number ?? created?.orderNumber, whatsappUrl: waUrl, orderId: created.id });
        } else {
          // Guarda o carrinho para restaurar caso o cliente desista do pagamento.
          try { const c = localStorage.getItem(`cart_${store.id}`); if (c) localStorage.setItem(`mpz_cart_backup_${created.id}`, c); } catch {}
          clearCart();
          window.location.href = mpr.checkoutUrl;
        }
        return;
      }

      if (usePixQr && !asQuote) {
        const payload = buildPixPayload({ key: gateway.pixKey, name: gateway.pixName, city: gateway.pixCity, amount: liveTotal, txid: created?.order_number ? `PED${created.order_number}` : undefined });
        setPixDialog({ payload, amount: liveTotal, orderNumber: created?.order_number ?? created?.orderNumber, whatsappUrl: waUrl });
        return;
      }

      if (waWindow && !waWindow.closed) {
        waWindow.location.href = waUrl;
        toast.success('Pedido enviado!');
        setTimeout(() => { clearCart(); navigate(`/${store.slug}`); }, 1500);
      } else {
        // Popup bloqueado: o cliente conclui o envio com um toque direto.
        setPendingWhatsApp({ url: waUrl, sellerName: chosenRecipient?.name || store.name });
      }
    } catch (err: any) {
      waWindow?.close();
      toast.error(err.message || 'Erro ao salvar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };
  if (sellerOrder && store.slug === 'dicolore') autoQuoteRef.current.run = () => handleSendWhatsApp(true);

  return (
    <div className="min-h-screen bg-background">
      {store.slug === 'mabelle' && store.settings.onlinePayments === true && <PaymentTestModeBanner />}
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="font-bold">Dados do Cliente</h1>
            <p className="text-sm text-muted-foreground">{cart.items.length} itens • Total: {formatCurrency(totalWithDelivery)}</p>
          </div>
        </div>
      </header>

      {offlineSaved && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 p-6">
          <div className="max-w-sm space-y-4 rounded-lg border-2 border-destructive bg-card p-6 text-center shadow-lg">
            <p className="text-2xl font-bold text-destructive">MODO OFFLINE</p>
            <p className="font-semibold">Pedido salvo no aparelho</p>
            <p className="text-sm text-muted-foreground">Ele ainda não foi integrado. Será enviado automaticamente ao painel quando a internet voltar.</p>
            <Button className="w-full" onClick={() => { clearCart(); if (sellerOrder) clearSelectedCustomer(); navigate(sellerOrder ? `/${store.slug}/vendedor/vendas` : `/${store.slug}`); }}>OK</Button>
          </div>
        </div>
      )}

      <ClosedBanner store={store} />

      <div className="container mt-3">
        <PendingOrdersCard storeId={store.id} />
      </div>

      <FinancialAlertBanner storeId={store?.id} slug={store?.slug} customerCode={(customerProfile as any)?.customerCode ?? (customerProfile as any)?.customer_code} customerName={customerProfile?.name} isSellerMode={isSellerMode && !!selectedCustomer} company={(store?.settings as any)?.titlesCompany} />
      <AlertDialog open={!!finalizeAsk} onOpenChange={(o) => { if (!o) { setFinalizeAsk(null); setReleaseConfirm(false); } }}>
        <AlertDialogContent>
          {finalizeAsk === 'ask-payment' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Forma/Condição de pagamento não selecionada</AlertDialogTitle>
                <AlertDialogDescription>Deseja alterar as Condições de pagamento agora?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setFinalizeAsk(null); handleSendWhatsApp(false, { decided: true }); }}>Não, só salvar</Button>
                <Button onClick={() => { setFinalizeAsk(null); setTimeout(() => document.getElementById('checkout-pagamento')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }}>Sim, alterar agora</Button>
              </AlertDialogFooter>
            </>
          ) : !releaseConfirm ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Finalizar pedido</AlertDialogTitle>
                <AlertDialogDescription>Deseja liberar p/ transmissão agora?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4" />Baixar PDF</Button>
                <Button variant="outline" onClick={() => { setFinalizeAsk(null); handleSendWhatsApp(false, { decided: true }); }}>Não, deixar Pendente</Button>
                <Button onClick={() => setReleaseConfirm(true)}>Sim</Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Liberar p/ transmissão</AlertDialogTitle>
                <AlertDialogDescription>O pedido será salvo e liberado para transmissão ao ERP.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setFinalizeAsk(null); setReleaseConfirm(false); }}>Cancelar</Button>
                <Button onClick={() => {
                  // Abre o WhatsApp no clique (iOS bloqueia depois de await).
                  const st: any = store?.settings || {};
                  const pt = String(activePriceTable || '');
                  const wa = String((pt && st.erpReleaseWhatsappByTable?.[pt]) || st.erpReleaseWhatsapp || '5547992491139').replace(/\D/g, '');
                  if (wa) window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`Olá, o pedido do cliente "${formData.name}" pode ser transmitido`)}`, '_blank');
                  setFinalizeAsk(null); setReleaseConfirm(false);
                  handleSendWhatsApp(false, { decided: true, release: true });
                }}>Liberar p/ transmissão</Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={prospectStep === 'ask' || prospectStep === 'finish'} onOpenChange={o => { if (!o) setProspectStep(null); }}>
        <AlertDialogContent>
          {prospectStep === 'ask' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cliente PROSPECT sem CPF/CNPJ</AlertDialogTitle>
                <AlertDialogDescription>Este cliente ainda não é cliente final e não tem CPF/CNPJ. Deseja editar o cadastro agora?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setProspectStep(null)}>Agora não</Button>
                <Button onClick={() => setProspectStep('edit')}>Editar cliente</Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Cadastro atualizado</AlertDialogTitle>
                <AlertDialogDescription>Deseja finalizar o pedido agora? Ele será liberado p/ transmissão.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setProspectStep(null)}>Não</Button>
                <Button onClick={() => { setProspectStep(null); setTimeout(() => handleSendWhatsApp(false, { decided: true, release: true }), 50); }}>Sim, finalizar</Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={prospectStep === 'edit'} onOpenChange={o => { if (!o) setProspectStep(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cliente PROSPECT</DialogTitle>
            <DialogDescription>Informe o CPF/CNPJ e confira os demais dados.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1"><Label>CPF/CNPJ *</Label><Input value={prospectForm.cpfCnpj} onChange={e => setProspectForm(f => ({ ...f, cpfCnpj: formatCPFCNPJ(e.target.value) }))} /></div>
            <div className="grid gap-1"><Label>Nome *</Label><Input value={prospectForm.name} onChange={e => setProspectForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="grid gap-1"><Label>WhatsApp *</Label><Input value={prospectForm.whatsapp} onChange={e => setProspectForm(f => ({ ...f, whatsapp: formatPhone(e.target.value) }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1 col-span-2"><Label>CEP</Label><Input value={prospectForm.cep} onChange={e => setProspectForm(f => ({ ...f, cep: formatCEP(e.target.value) }))} /></div>
              <div className="grid gap-1"><Label>UF *</Label><Input maxLength={2} value={prospectForm.uf} onChange={e => setProspectForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} /></div>
            </div>
            <div className="grid gap-1"><Label>Cidade *</Label><Input value={prospectForm.city} onChange={e => setProspectForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div className="grid gap-1"><Label>Bairro</Label><Input value={prospectForm.neighborhood} onChange={e => setProspectForm(f => ({ ...f, neighborhood: e.target.value }))} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-1 col-span-2"><Label>Endereço *</Label><Input value={prospectForm.address} onChange={e => setProspectForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid gap-1"><Label>Número</Label><Input value={prospectForm.number} onChange={e => setProspectForm(f => ({ ...f, number: e.target.value }))} /></div>
            </div>
            <Button onClick={saveProspect} disabled={prospectSaving}>{prospectSaving ? 'Salvando...' : 'Salvar cliente'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {editingQuote && (sellerOrder || editingQuote.byCustomer) && <EditingQuoteBanner name={editingQuote.customerName} />}

      {isSellerMode && (
        <div className="border-b border-primary/30 bg-primary/10">
          <div className="container flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>
              <span className="font-semibold">Modo Vendedor</span>
              {selectedCustomer
                ? <> — pedido para <span className="font-semibold">{selectedCustomer.name}</span>{selectedCustomer.customerCode ? ` (#${selectedCustomer.customerCode})` : <span className="ml-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">PROSPECT</span>} • Tabela {activePriceTable}</>
                : ' — selecione o cliente para finalizar'}
            </span>
            <Button size="sm" variant={selectedCustomer ? 'outline' : 'default'} onClick={() => setSellerCustomerDialogOpen(true)}>
              {selectedCustomer ? 'Trocar cliente' : 'Selecionar cliente'}
            </Button>
          </div>
          <SellerCustomerDialog
            open={sellerCustomerDialogOpen}
            onOpenChange={setSellerCustomerDialogOpen}
            storeId={store.id}
            storeSlug={store.slug}
            sellerCodes={seller.isAdmin ? [] : seller.sellerCodes}
            onSelected={(c) => {
              if (selectedCustomer && selectedCustomer.id !== c.id) clearCart();
              selectCustomer(c);
            }}
          />
        </div>
      )}

      <main className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input readOnly={lockedCustomerData} id="name" value={formData.name} onChange={e => handleInputChange('name', e.target.value.toUpperCase())} placeholder="NOME COMPLETO" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp">WhatsApp *</Label>
                    <Input readOnly={lockedCustomerData} id="whatsapp" value={formData.whatsapp} onChange={e => handleInputChange('whatsapp', formatPhone(e.target.value))} placeholder="(47) 99999-9999" />
                  </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                      <Input
                        readOnly={lockedCustomerData}
                        id="cpfCnpj"
                        value={formData.cpfCnpj}
                        onChange={e => handleInputChange('cpfCnpj', formatCPFCNPJ(e.target.value))}
                        placeholder="CPF ou CNPJ do destinatário"
                      />
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Endereço completo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {offersDelivery && (
                  <div className="space-y-2">
                    <Label>Modalidade *</Label>
                    <RadioGroup
                      value={deliveryType}
                      onValueChange={v => {
                        setDeliveryType(v as 'entrega' | 'retirada');
                        if (v === 'retirada') { setSelectedNeighborhoodId(''); setSelectedShipping(''); }
                      }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <label htmlFor="dt-entrega" className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${deliveryType === 'entrega' ? 'border-primary bg-primary/5' : ''}`}>
                        <RadioGroupItem value="entrega" id="dt-entrega" />
                        <span className="font-medium">🚚 Entregar</span>
                      </label>
                      <label htmlFor="dt-retirada" className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${deliveryType === 'retirada' ? 'border-primary bg-primary/5' : ''}`}>
                        <RadioGroupItem value="retirada" id="dt-retirada" />
                        <span className="font-medium">🏪 Retirar na loja</span>
                      </label>
                    </RadioGroup>
                  </div>
                )}

                {hasNeighborhoods && deliveryType === 'entrega' && (
                  <div className="grid gap-2">
                    <Label>Bairro de entrega *</Label>
                    <Select
                      value={selectedNeighborhoodId}
                      onValueChange={id => {
                        setSelectedNeighborhoodId(id);
                        const nb = neighborhoods!.find(n => n.id === id);
                        if (nb) handleInputChange('neighborhood', nb.name);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione o bairro" /></SelectTrigger>
                      <SelectContent>
                        {neighborhoods!.map(n => (
                          <SelectItem key={n.id} value={n.id}>
                            {n.name} — {formatCurrency(n.fee)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {lockedCustomerData || (!useOtherAddress && !hasNeighborhoods && !getCustomerError(formData)) ? (
                  <div className="rounded-md border bg-muted/40 p-4 text-sm space-y-3">
                    <div>
                      <p className="font-medium">Endereço do cadastro</p>
                      <p>{formData.address}{formData.number ? `, ${formData.number}` : ''}{formData.complement ? ` - ${formData.complement}` : ''}</p>
                      <p>{[formData.neighborhood, `${formData.city}/${formData.uf}`].filter(Boolean).join(' - ')}</p>
                      <p>CEP {formData.cep}</p>
                    </div>
                      {!lockedCustomerData && <Button type="button" variant="outline" size="sm" onClick={() => setUseOtherAddress(true)}>
                        Escolher endereço
                      </Button>}
                  </div>
                ) : (
                <>
                {customerProfile?.cep && customerProfile?.address && !hasNeighborhoods && (
                  <Button type="button" variant="link" size="sm" className="px-0" onClick={() => {
                    restoreProfileAddress();
                    const c = (customerProfile.cep || '').replace(/\D/g, '');
                    if (c.length === 8) fetchShippingQuote(c);
                  }}>
                    Usar endereço do cadastro
                  </Button>
                )}
                {!lockedCustomerData && savedAddresses.length > 0 && <Select onValueChange={id => { const a = savedAddresses.find(a => a.id === id); if (!a) return; setFormData(prev => ({ ...prev, cep: a.cep, uf: a.uf, city: a.city, neighborhood: a.neighborhood, address: a.address, number: a.number, complement: a.complement })); fetchShippingQuote(a.cep.replace(/\D/g, '')); }}><SelectTrigger><SelectValue placeholder="Escolher endereço salvo" /></SelectTrigger><SelectContent>{savedAddresses.map(a => <SelectItem key={a.id} value={a.id}>{a.label} — {a.address}, {a.number}</SelectItem>)}</SelectContent></Select>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input readOnly={lockedCustomerData} id="cep" value={formData.cep} onChange={async e => {
                      const formatted = formatCEP(e.target.value);
                      handleInputChange('cep', formatted);
                      const cleaned = formatted.replace(/\D/g, '');
                      if (cleaned.length === 8) {
                        const result = await fetchAddressByCep(cleaned);
                        if (result) {
                          setFormData(prev => ({ ...prev, uf: result.uf, city: result.city, neighborhood: result.neighborhood, address: result.address }));
                        }
                        fetchShippingQuote(cleaned);
                      }
                    }} placeholder="00000-000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="uf">UF *</Label>
                    <Select disabled={lockedCustomerData} value={formData.uf} onValueChange={value => handleInputChange('uf', value)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{brazilianStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="city">Cidade *</Label><Input readOnly={lockedCustomerData} id="city" value={formData.city} onChange={e => handleInputChange('city', e.target.value)} /></div>
                  <div className="grid gap-2"><Label htmlFor="neighborhood">Bairro *</Label><Input readOnly={lockedCustomerData} id="neighborhood" value={formData.neighborhood} onChange={e => handleInputChange('neighborhood', e.target.value)} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2 sm:col-span-2"><Label htmlFor="address">Endereço *</Label><Input readOnly={lockedCustomerData} id="address" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} /></div>
                  <div className="grid gap-2"><Label htmlFor="number">Número *</Label><Input readOnly={lockedCustomerData} id="number" value={formData.number} onChange={e => handleInputChange('number', e.target.value)} /></div>
                </div>
                <div className="grid gap-2"><Label htmlFor="complement">Complemento</Label><Input readOnly={lockedCustomerData} id="complement" value={formData.complement} onChange={e => handleInputChange('complement', e.target.value)} /></div>
                </>
                )}
              </CardContent>
            </Card>

            {/* Shipping options */}
            {shippingEnabled && !isPickupSel && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Frete</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {shippingLoading && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Calculando frete...
                    </div>
                  )}
                  {!shippingLoading && !shippingQuoted && (
                    <p className="text-sm text-muted-foreground">Digite o CEP acima para calcular o frete.</p>
                  )}
                  {!shippingLoading && (
                    <Button type="button" variant="outline" size="sm"
                      disabled={(formData.cep || '').replace(/\D/g, '').length !== 8}
                      onClick={() => fetchShippingQuote((formData.cep || '').replace(/\D/g, ''))}>
                      <Truck className="mr-2 h-4 w-4" /> Calcular frete
                    </Button>
                  )}
                  {!shippingLoading && shippingQuoted && shippingOptions.length === 0 && (
                    <p className="text-sm text-destructive">Não foi possível calcular o frete para este CEP.</p>
                  )}
                  {!shippingLoading && shippingOptions.length > 0 && (
                    <RadioGroup value={selectedShipping} onValueChange={setSelectedShipping} className="space-y-2">
                      {shippingOptions.map(opt => (
                        <div key={opt.code} className="flex items-center space-x-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50">
                          <RadioGroupItem value={opt.code} id={`shipping-${opt.code}`} />
                          <Label htmlFor={`shipping-${opt.code}`} className="flex-1 cursor-pointer">
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">{opt.name}</span>
                                <span className="text-sm text-muted-foreground ml-2">({opt.deadline} dias úteis)</span>
                              </div>
                              <span className="font-semibold">{formatCurrency(opt.price)}</span>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            )}

            <Card id="checkout-pagamento">
              <CardHeader><CardTitle>Pagamento e Entrega</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Forma de Pagamento</Label>
                  {dicolore ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <Label className="text-xs">{store.slug === 'dicoloresenses' ? 'Condição de Pagamento' : 'Forma de Pagamento (ERP)'}</Label>
                        <Select value={paymentFormaCodigo} onValueChange={setPaymentFormaCodigo} disabled={restoringPayment || paymentRestoreError}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="max-h-[40vh]">
                            {formas.map(f => (
                              <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} - {f.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">{store.slug === 'dicoloresenses' ? 'Prazo de Pagamento' : 'Condição de Pagamento (ERP)'}</Label>
                        <Select value={paymentCondicaoCodigo} onValueChange={setPaymentCondicaoCodigo} disabled={restoringPayment || paymentRestoreError}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="max-h-[40vh]">
                            {condicoes.map(c => (
                              <SelectItem key={c.codigo} value={c.codigo}>{c.codigo} - {c.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : (
                    <RadioGroup value={formData.paymentMethod} onValueChange={value => handleInputChange('paymentMethod', value)} className="flex flex-wrap gap-4">
                      {availablePaymentMethods.includes('pix') && <div className="flex items-center space-x-2"><RadioGroupItem value="pix" id="pix" /><Label htmlFor="pix" className="cursor-pointer">PIX</Label></div>}
                      {availablePaymentMethods.includes('boleto') && <div className="flex items-center space-x-2"><RadioGroupItem value="boleto" id="boleto" /><Label htmlFor="boleto" className="cursor-pointer">Boleto</Label></div>}
                      {availablePaymentMethods.includes('cartao') && <div className="flex items-center space-x-2"><RadioGroupItem value="cartao" id="cartao" /><Label htmlFor="cartao" className="cursor-pointer">Cartão</Label></div>}
                      {availablePaymentMethods.includes('dinheiro') && <div className="flex items-center space-x-2"><RadioGroupItem value="dinheiro" id="dinheiro" /><Label htmlFor="dinheiro" className="cursor-pointer">Dinheiro</Label></div>}
                    </RadioGroup>
                  )}
                </div>
                {recipientOptions.length > 0 && !sellerOrder && (
                  <div className="rounded-lg border-2 border-primary/60 bg-primary/5 p-4 space-y-3">
                    <Label className="text-base font-bold flex items-center gap-2">
                      📱 Enviar pedido para <span className="text-destructive">*</span>
                    </Label>
                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                      <SelectTrigger className="border-primary/40"><SelectValue placeholder="Selecione o vendedor" /></SelectTrigger>
                      <SelectContent className="max-h-[40vh]">
                        {recipientOptions.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                            {s.kind === 'televendas' ? ' · Televendas' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-3">
                  <Label>Turno de Entrega</Label>
                  <RadioGroup value={formData.deliveryShift} onValueChange={value => handleInputChange('deliveryShift', value)} className="flex gap-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="manha" id="manha" /><Label htmlFor="manha" className="cursor-pointer">Manhã</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="tarde" id="tarde" /><Label htmlFor="tarde" className="cursor-pointer">Tarde</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="noite" id="noite" /><Label htmlFor="noite" className="cursor-pointer">Noite</Label></div>
                  </RadioGroup>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="observations">Observações</Label>
                  <Textarea id="observations" value={formData.observations} onChange={e => handleInputChange('observations', e.target.value)} placeholder="Observações adicionais..." rows={3} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="sticky top-20">
              <CardHeader><CardTitle>Resumo do Pedido</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="max-h-64 space-y-2 overflow-auto">
                  {cart.items.map(item => {
                    const itemKey = `${item.productId}-${item.variantId || ''}`;
                    const discPct = itemDiscounts[itemKey] || 0;
                    const discountedPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
                    const variantParts = [item.color, item.size].filter(Boolean).join(' · ');
                    return (
                      <div key={`${item.productId}-${item.variantId}`} className="rounded-md border p-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{item.name}</div>
                            {variantParts && (
                              <div className="text-xs text-muted-foreground mt-0.5">{variantParts}</div>
                            )}
                            {discPct > 0 && (
                              <div className="text-xs text-accent mt-0.5">-{discPct}%</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => removeItem(item.productId, item.variantId)}
                              className="text-muted-foreground hover:text-destructive"
                              aria-label="Remover item"
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <span className="font-semibold">{formatCurrency(discountedPrice * item.quantity)}</span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                           <QuantityStepper
                             value={item.quantity}
                             buttonVariant="outline"
                             decrementDisabled={item.quantity === 0}
                             onChange={(n) => { if (n > item.quantity && wouldExceedMaterialApoio(cart.items, item.productId, item.price * (n - item.quantity), allProductsCk as any, store?.settings.materialApoio).exceeds) { toast.error(MATERIAL_APOIO_MSG); return; } updateQuantity(item.productId, n, item.variantId); }}
                             onDecrement={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                             onIncrement={() => { if (wouldExceedMaterialApoio(cart.items, item.productId, item.price, allProductsCk as any, store?.settings.materialApoio).exceeds) { toast.error(MATERIAL_APOIO_MSG); return; } updateQuantity(item.productId, item.quantity + 1, item.variantId); }}
                           />
                          <span className="text-xs text-muted-foreground">{formatCurrency(discountedPrice)} un.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
                  {cart.quantityDiscount > 0 && <div className="flex justify-between text-accent"><span>Desc. quantidade</span><span>-{formatCurrency(cart.quantityDiscount)}</span></div>}
                  {cart.couponDiscount > 0 && <div className="flex justify-between text-accent"><span>Cupom</span><span>-{formatCurrency(cart.couponDiscount)}</span></div>}
                  {deliveryFee > 0 && (
                    <div className="flex items-center justify-between rounded-md border border-accent/40 bg-accent/10 px-2 py-1.5">
                      <span className="flex items-center gap-1 text-sm font-medium">
                        <Truck className="h-4 w-4" />
                        {selectedShippingOption
                          ? `Frete (${selectedShippingOption.name})`
                          : selectedNeighborhood
                            ? `Taxa de entrega — ${selectedNeighborhood.name}`
                            : 'Taxa de entrega'}
                      </span>
                      <span className="font-semibold">{formatCurrency(deliveryFee)}</span>
                    </div>
                  )}
                  {isPickupSel && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Retirar na loja</span><span>Sem taxa</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(totalWithDelivery)}</span></div>
                  {deliveryFee > 0 && (
                    <p className="text-xs text-muted-foreground">Inclui taxa de entrega de {formatCurrency(deliveryFee)}.</p>
                  )}
                </div>
                {(() => {
                  const minOrder = effectiveMinOrder(store, !!isSellerMode);
                  const effectiveTotal = cart.subtotal - (cart.quantityDiscount || 0);
                  const missing = Math.max(0, minOrder - effectiveTotal);
                  if (minOrder > 0 && missing > 0) {
                    return (
                      <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200">
                        <p className="font-semibold">Pedido mínimo: {formatCurrency(minOrder)}</p>
                        <p>Faltam <strong>{formatCurrency(missing)}</strong> em produtos para finalizar (já considerando descontos).</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="grid gap-2 pt-4">
                  <Button variant="secondary" asChild className="w-full gap-2">
                    <Link to={`/${store.slug}`}><ShoppingBag className="h-4 w-4" /> Continuar Comprando</Link>
                  </Button>
                  {!['dicolore', 'dicoloresenses'].includes(store.slug) && (
                    <Button variant="outline" onClick={handleDownloadTxt} className="w-full gap-2"><Download className="h-4 w-4" /> Baixar TXT</Button>
                  )}
                  <Button
                    onClick={() => handleSendWhatsApp()}
                    disabled={isSubmitting || restoringPayment || paymentRestoreError || !storeOpenStatus.open || (effectiveMinOrder(store, !!isSellerMode) > 0 && (cart.subtotal - (cart.quantityDiscount || 0)) < effectiveMinOrder(store, !!isSellerMode))}
                    className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <MessageCircle className="h-4 w-4" /> {isSubmitting ? 'Enviando...' : (!storeOpenStatus.open ? 'Loja fechada' : (store.slug === 'mabelle' && store.settings.onlinePayments === true ? 'PAGAR PEDIDO' : ((sellerOrder || store.slug === 'dicoloresenses') ? 'FINALIZAR PEDIDO' : (store.slug === 'jewosnewborn' ? 'Pagar e enviar pelo WhatsApp' : 'Enviar pelo WhatsApp'))))}
                  </Button>
                  {sellerOrder && store.slug === 'dicolore' && (
                    <Button variant="outline" disabled={isSubmitting} onClick={() => handleSendWhatsApp(true)} className="w-full gap-2">
                      <Download className="h-4 w-4" /> SALVAR ORÇAMENTO
                    </Button>
                  )}
                  <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-xs text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200">
                    <p className="font-semibold">Aviso:</p>
                    <p>Devido ao alto giro da plataforma, produtos podem ficar sem estoque sem prévio aviso.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={!!pendingWhatsApp} onOpenChange={(v) => { if (!v) { setPendingWhatsApp(null); clearCart(); navigate(`/${store.slug}`); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pedido registrado!</DialogTitle>
            <DialogDescription>
              Toque no botão abaixo para enviar o pedido pelo WhatsApp de {pendingWhatsApp?.sellerName}.
            </DialogDescription>
          </DialogHeader>
          <Button asChild size="lg" className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <a
              href={pendingWhatsApp?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => { setPendingWhatsApp(null); setTimeout(() => { clearCart(); navigate(`/${store.slug}`); }, 800); }}
            >
              <MessageCircle className="h-4 w-4" /> Abrir WhatsApp de {pendingWhatsApp?.sellerName}
            </a>
          </Button>
        </DialogContent>
      </Dialog>
      <PixPaymentDialog data={pixDialog} onClose={() => { setPixDialog(null); clearCart(); navigate(`/${store.slug}`); }} />
      {/* PIX Mercado Pago: confirmação automática; WhatsApp só após pagamento confirmado */}
      <Dialog open={!!onlineCheckout} onOpenChange={(open) => { if (!open) setOnlineCheckout(null); }}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="border-b p-5">
            <DialogTitle>Pagamento seguro</DialogTitle>
            <DialogDescription>Conclua o pagamento para confirmar o pedido.</DialogDescription>
          </DialogHeader>
          <div className="p-2 sm:p-5">
            {onlineCheckout && <MabelleEmbeddedCheckout {...onlineCheckout} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
