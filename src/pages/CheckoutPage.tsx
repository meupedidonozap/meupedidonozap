import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, MessageCircle, Loader2, LogIn, Truck, Plus, Minus, X, ShoppingBag } from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useCreateOrder } from '@/hooks/useOrders';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile, useUpsertCustomerProfile } from '@/hooks/useCustomerProfile';
import { useStoreSellers } from '@/hooks/useStoreSellers';
import { useOrderRecipients } from '@/hooks/useOrderRecipients';
import { useCart } from '@/contexts/CartContext';
import {
  formatCurrency, formatCPFCNPJ, formatPhone, formatCEP,
  generateWhatsAppMessage, openWhatsApp, downloadTxt,
} from '@/lib/formatters';
import { fetchAddressByCep } from '@/lib/cepLookup';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import ClosedBanner from '@/components/ClosedBanner';
import { useStoreOpen } from '@/hooks/useStoreOpen';
import type { PaymentMethod, DeliveryShift } from '@/types';
import { getStoreFormas, getStoreCondicoes, isDicoloreFlow } from '@/lib/dicolorePayments';

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
  const createOrder = useCreateOrder();
  const { cart, clearCart, itemDiscounts, updateQuantity, removeItem } = useCart();
  const { user, loading: authLoading } = useAuth();
  const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);
  const { data: sellers = [] } = useStoreSellers(store?.id);
  const { data: recipientsRpc = [] } = useOrderRecipients(store?.id, customerProfile?.sellerCode);
  // If customer has a linked seller, restrict the dropdown to that seller + any televendas linked to them.
  // Otherwise fall back to all active sellers.
  const recipientOptions = (customerProfile?.sellerCode && recipientsRpc.length > 0)
    ? recipientsRpc.map(r => ({ id: r.id, name: r.name, whatsapp: r.whatsapp, kind: r.kind }))
    : sellers.map(s => ({ id: s.id, name: s.name, whatsapp: s.whatsapp, kind: 'vendedor' as const }));
  const upsertProfile = useUpsertCustomerProfile();
  const storeOpenStatus = useStoreOpen(store);
  const dicolore = isDicoloreFlow(store?.slug, store?.settings);
  const formas = getStoreFormas(store?.settings).filter(f => f.ativo);
  const condicoes = getStoreCondicoes(store?.settings).filter(c => c.ativo);

  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
    paymentMethod: 'pix' as PaymentMethod,
    deliveryShift: 'tarde' as DeliveryShift,
    observations: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  // Dicolore ERP payment codes
  const [paymentFormaCodigo, setPaymentFormaCodigo] = useState<string>('');
  const [paymentCondicaoCodigo, setPaymentCondicaoCodigo] = useState<string>('');

  // Shipping state
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingQuoted, setShippingQuoted] = useState(false);

  // Delivery type (COMIDA/PIZZARIA)
  const [deliveryType, setDeliveryType] = useState<'entrega' | 'retirada'>('entrega');
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState<string>('');

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
      setProfileLoaded(true);
    }
  }, [customerProfile, profileLoaded]);

  // Auto-select the only available recipient (e.g. customer has just one linked seller)
  useEffect(() => {
    if (!selectedSellerId && recipientOptions.length === 1) {
      setSelectedSellerId(recipientOptions[0].id);
    }
  }, [recipientOptions, selectedSellerId]);

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
        <CustomerAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} storeId={store.id} storeSlug={store.slug} />
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const isPickup = (hasNeighborhoods && deliveryType === 'retirada') || !offersDelivery;
    const required = isPickup ? ['name', 'whatsapp'] : ['name', 'whatsapp', 'uf', 'city', 'address'];
    for (const field of required) {
      if (!formData[field as keyof typeof formData]) {
        toast.error(`Preencha o campo obrigatório: ${field}`);
        return false;
      }
    }
    if (offersDelivery && hasNeighborhoods && deliveryType === 'entrega' && !selectedNeighborhoodId) {
      toast.error('Selecione o bairro de entrega');
      return false;
    }
    if (recipientOptions.length > 0 && !selectedSellerId) {
      toast.error('Selecione o vendedor para enviar o pedido');
      return false;
    }
    if (offersDelivery && shippingEnabled && shippingOptions.length > 0 && !selectedShipping) {
      toast.error('Selecione a modalidade de frete');
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

  let deliveryFee = 0;
  if (!offersDelivery) {
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
          originCep: shipping.originCep,
          destinyCep,
          weight: shipping.defaultWeight,
          length: shipping.defaultLength,
          width: shipping.defaultWidth,
          height: shipping.defaultHeight,
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

  const generateOrderMessage = () => {
    return generateWhatsAppMessage({
      storeName: store.name,
      customer: {
        name: formData.name, cpfCnpj: formData.cpfCnpj, whatsapp: formData.whatsapp,
        address: `${formData.address}, ${formData.number}`,
        neighborhood: formData.neighborhood, city: formData.city, uf: formData.uf, cep: formData.cep,
      },
      items: cart.items.map(item => ({
        code: item.code,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        color: item.color,
        discountPercent: itemDiscounts[`${item.productId}-${item.variantId || ''}`] || 0,
      })),
      subtotal: cart.subtotal,
      discount: cart.couponDiscount,
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

  const handleSendWhatsApp = async () => {
    if (!validateForm()) return;
    if (!storeOpenStatus.open) {
      toast.error(`Loja fechada${storeOpenStatus.message ? ` — ${storeOpenStatus.message}` : ''}. Pedidos só dentro do horário.`);
      return;
    }
    const minOrder = store?.settings?.minOrderValue || 0;
    if (minOrder > 0 && cart.subtotal < minOrder) {
      toast.error(`Pedido mínimo de ${formatCurrency(minOrder)}. Faltam ${formatCurrency(minOrder - cart.subtotal)} em produtos.`);
      return;
    }
    setIsSubmitting(true);
    try {
      const isPickup = (hasNeighborhoods && deliveryType === 'retirada') || !offersDelivery;
      const observationsFinal = [
        !offersDelivery ? '' : (isPickup ? '[RETIRAR NA LOJA]' : (selectedNeighborhood ? `[ENTREGA: ${selectedNeighborhood.name}]` : '')),
        formData.observations || '',
      ].filter(Boolean).join(' ').trim();

      // Save/update customer profile (sempre, mesmo em retirada — preserva cliente em Clientes)
      try {
        await upsertProfile.mutateAsync({
          userId: user.id,
          storeId: store.id,
          name: formData.name,
          cpfCnpj: formData.cpfCnpj,
          whatsapp: formData.whatsapp,
          cep: isPickup ? '' : formData.cep,
          uf: isPickup ? '' : formData.uf,
          city: isPickup ? '' : formData.city,
          neighborhood: isPickup ? '' : formData.neighborhood,
          address: isPickup ? '' : formData.address,
          number: isPickup ? '' : formData.number,
          complement: isPickup ? undefined : (formData.complement || undefined),
        });
      } catch (profileErr) {
        // Não bloqueia o pedido se o upsert do perfil falhar
        console.warn('[checkout] upsertProfile falhou:', profileErr);
      }

      await createOrder.mutateAsync({
        storeId: store.id,
        customer: {
          name: formData.name, cpfCnpj: formData.cpfCnpj, whatsapp: formData.whatsapp,
          cep: isPickup ? '' : formData.cep, uf: isPickup ? '' : formData.uf, city: isPickup ? '' : formData.city,
          neighborhood: isPickup ? 'RETIRAR NA LOJA' : formData.neighborhood,
          address: isPickup ? 'RETIRAR NA LOJA' : formData.address,
          number: isPickup ? '' : formData.number,
          complement: isPickup ? '' : formData.complement,
          ...(dicolore ? {
            paymentFormaCodigo: paymentFormaCodigo || undefined,
            paymentFormaDescricao: formas.find(f => f.codigo === paymentFormaCodigo)?.descricao,
            paymentCondicaoCodigo: paymentCondicaoCodigo || undefined,
            paymentCondicaoDescricao: condicoes.find(c => c.codigo === paymentCondicaoCodigo)?.descricao,
          } : {}),
        },
        items: cart.items.map(item => ({
          ...item,
          discountPercent: itemDiscounts[`${item.productId}-${item.variantId || ''}`] || undefined,
        })),
        subtotal: cart.subtotal,
        discount: totalDiscount,
        deliveryFee,
        total: totalWithDelivery,
        paymentMethod: formData.paymentMethod,
        deliveryShift: formData.deliveryShift,
        observations: observationsFinal || undefined,
        status: 'pendente',
      });

      const targetWhatsapp = recipientOptions.length > 0 && selectedSellerId
        ? (recipientOptions.find(s => s.id === selectedSellerId)?.whatsapp || store.whatsapp)
        : store.whatsapp;
      openWhatsApp(targetWhatsapp, generateOrderMessage());
      toast.success('Pedido enviado!');
      setTimeout(() => { clearCart(); navigate(`/${store.slug}`); }, 1500);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="font-bold">Dados do Cliente</h1>
            <p className="text-sm text-muted-foreground">{cart.items.length} itens • Total: {formatCurrency(totalWithDelivery)}</p>
          </div>
        </div>
      </header>

      <ClosedBanner store={store} />

      <main className="container py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>Informações Pessoais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" value={formData.name} onChange={e => handleInputChange('name', e.target.value.toUpperCase())} placeholder="NOME COMPLETO" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="whatsapp">WhatsApp *</Label>
                    <Input id="whatsapp" value={formData.whatsapp} onChange={e => handleInputChange('whatsapp', formatPhone(e.target.value))} placeholder="(47) 99999-9999" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {offersDelivery && (
            <Card>
              <CardHeader><CardTitle>Endereço de Entrega</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {hasNeighborhoods && (
                  <div className="space-y-2">
                    <Label>Modalidade *</Label>
                    <RadioGroup
                      value={deliveryType}
                      onValueChange={v => {
                        setDeliveryType(v as 'entrega' | 'retirada');
                        if (v === 'retirada') setSelectedNeighborhoodId('');
                      }}
                      className="grid grid-cols-2 gap-2"
                    >
                      <label htmlFor="dt-entrega" className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer ${deliveryType === 'entrega' ? 'border-primary bg-primary/5' : ''}`}>
                        <RadioGroupItem value="entrega" id="dt-entrega" />
                        <span className="font-medium">🛵 Entregar</span>
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

                {hasNeighborhoods && deliveryType === 'retirada' ? (
                  <div className="rounded-md border border-dashed bg-muted/40 p-4 text-sm">
                    O pedido será retirado no endereço da loja. Não há taxa de entrega.
                  </div>
                ) : (
                <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="cep">CEP</Label>
                    <Input id="cep" value={formData.cep} onChange={async e => {
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
                    <Select value={formData.uf} onValueChange={value => handleInputChange('uf', value)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{brazilianStates.map(state => <SelectItem key={state} value={state}>{state}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="city">Cidade *</Label><Input id="city" value={formData.city} onChange={e => handleInputChange('city', e.target.value)} /></div>
                  <div className="grid gap-2"><Label htmlFor="neighborhood">Bairro</Label><Input id="neighborhood" value={formData.neighborhood} onChange={e => handleInputChange('neighborhood', e.target.value)} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-2 sm:col-span-2"><Label htmlFor="address">Endereço *</Label><Input id="address" value={formData.address} onChange={e => handleInputChange('address', e.target.value)} /></div>
                  <div className="grid gap-2"><Label htmlFor="number">Número</Label><Input id="number" value={formData.number} onChange={e => handleInputChange('number', e.target.value)} /></div>
                </div>
                <div className="grid gap-2"><Label htmlFor="complement">Complemento</Label><Input id="complement" value={formData.complement} onChange={e => handleInputChange('complement', e.target.value)} /></div>
                </>
                )}
              </CardContent>
            </Card>
            )}

            {/* Shipping options */}
            {shippingEnabled && (
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

            <Card>
              <CardHeader><CardTitle>Pagamento e Entrega</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Forma de Pagamento</Label>
                  {dicolore ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-1">
                        <Label className="text-xs">Forma de Pagamento (ERP)</Label>
                        <Select value={paymentFormaCodigo} onValueChange={setPaymentFormaCodigo}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent className="max-h-[40vh]">
                            {formas.map(f => (
                              <SelectItem key={f.codigo} value={f.codigo}>{f.codigo} - {f.descricao}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">Condição de Pagamento (ERP)</Label>
                        <Select value={paymentCondicaoCodigo} onValueChange={setPaymentCondicaoCodigo}>
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
                      {store.settings.acceptPix && <div className="flex items-center space-x-2"><RadioGroupItem value="pix" id="pix" /><Label htmlFor="pix" className="cursor-pointer">PIX</Label></div>}
                      {store.settings.acceptBoleto && <div className="flex items-center space-x-2"><RadioGroupItem value="boleto" id="boleto" /><Label htmlFor="boleto" className="cursor-pointer">Boleto</Label></div>}
                      {store.settings.acceptCard && <div className="flex items-center space-x-2"><RadioGroupItem value="cartao" id="cartao" /><Label htmlFor="cartao" className="cursor-pointer">Cartão</Label></div>}
                      <div className="flex items-center space-x-2"><RadioGroupItem value="dinheiro" id="dinheiro" /><Label htmlFor="dinheiro" className="cursor-pointer">Dinheiro</Label></div>
                    </RadioGroup>
                  )}
                </div>
                {recipientOptions.length > 0 && (
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
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
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
                  {hasNeighborhoods && deliveryType === 'retirada' && (
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
                  const minOrder = store.settings?.minOrderValue || 0;
                  const missing = Math.max(0, minOrder - cart.subtotal);
                  if (minOrder > 0 && missing > 0) {
                    return (
                      <div className="mt-3 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200">
                        <p className="font-semibold">Pedido mínimo: {formatCurrency(minOrder)}</p>
                        <p>Faltam <strong>{formatCurrency(missing)}</strong> em produtos para finalizar.</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="grid gap-2 pt-4">
                  <Button variant="secondary" asChild className="w-full gap-2">
                    <Link to={`/${store.slug}`}><ShoppingBag className="h-4 w-4" /> Continuar Comprando</Link>
                  </Button>
                  {store.slug !== 'dicolore' && (
                    <Button variant="outline" onClick={handleDownloadTxt} className="w-full gap-2"><Download className="h-4 w-4" /> Baixar TXT</Button>
                  )}
                  <Button
                    onClick={handleSendWhatsApp}
                    disabled={isSubmitting || !storeOpenStatus.open || ((store.settings?.minOrderValue || 0) > 0 && cart.subtotal < (store.settings?.minOrderValue || 0))}
                    className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <MessageCircle className="h-4 w-4" /> {isSubmitting ? 'Enviando...' : (!storeOpenStatus.open ? 'Loja fechada' : 'Enviar pelo WhatsApp')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
