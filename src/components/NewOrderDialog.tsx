import { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Trash2, Search, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/formatters';
import { toast } from 'sonner';
import { useCreateOrder } from '@/hooks/useOrders';
import type { Store, Product, FoodItem, CartItem, PaymentMethod, DeliveryShift, CustomerInfo } from '@/types';
import { wouldExceedMaterialApoio, MATERIAL_APOIO_MSG } from '@/lib/materialApoio';
import { computeGroupDiscounts } from '@/lib/groupDiscounts';
import { getProductPriceOrNull, getVariantPriceOrNull, hasStock, DEFAULT_PRICE_TABLE, normalizePriceTable, type PriceTable } from '@/lib/pricing';

interface CustomerProfile {
  id: string;
  name: string;
  whatsapp: string;
  cpfCnpj?: string;
  cep?: string;
  uf?: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  number?: string;
  complement?: string;
  priceTable?: 1 | 4 | 9 | 11;
}

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  store: Store;
  products: Product[];
  foodItems: FoodItem[];
  customerProfiles: CustomerProfile[];
  categories: { id: string; name: string }[];
}

export default function NewOrderDialog({
  open, onOpenChange, store, products, foodItems, customerProfiles, categories,
}: NewOrderDialogProps) {
  const createOrder = useCreateOrder();
  const stockEnabled = (store as any)?.settings?.useStockIntegration === true;
  // Algumas lojas COMIDA (ex.: Pastelaria RM) cadastram itens em `products`.
  // Caímos para `products` quando não há registros em `food_items`.
  const useFoodCatalog = store.type === 'COMIDA' && foodItems.length > 0;
  const isFood = useFoodCatalog;
  const catalogItems = useFoodCatalog ? foodItems : products;
  const offersDelivery = store.settings?.offersDelivery !== false;

  // Step state
  const [step, setStep] = useState<'customer' | 'items' | 'review'>('customer');

  // Customer
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerForm, setCustomerForm] = useState<CustomerInfo>({
    name: '', cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '',
    neighborhood: '', address: '', number: '', complement: '',
  });

  // Items
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Variant picker (for products with size/color variants)
  const [variantPicker, setVariantPicker] = useState<{ product: any; color?: string; size?: string } | null>(null);

  // Order details
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [deliveryShift, setDeliveryShift] = useState<DeliveryShift>('tarde');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customerProfiles;
    const q = customerSearch.toLowerCase();
    return customerProfiles.filter(c =>
      c.name?.toLowerCase().includes(q) || c.whatsapp?.includes(q)
    );
  }, [customerProfiles, customerSearch]);

  /** Tabela de preço do cliente selecionado (novo cliente = padrão). */
  const activeTable: PriceTable = useMemo(() => {
    if (customerMode !== 'existing') return DEFAULT_PRICE_TABLE;
    const cp = customerProfiles.find(c => c.id === selectedCustomerId);
    return normalizePriceTable(cp?.priceTable);
  }, [customerMode, selectedCustomerId, customerProfiles]);

  /** Preço do produto para a tabela ativa (null = não vendável). */
  const priceOf = (p: any): number | null => {
    if (isFood) {
      const n = Number(p?.price);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return getProductPriceOrNull(p, activeTable);
  };

  /** Variações com preço válido na tabela ativa. */
  const sellableVariants = (p: any): any[] =>
    (Array.isArray(p?.variants) ? p.variants : []).filter(
      (v: any) => getVariantPriceOrNull(v, activeTable) !== null && (!stockEnabled || Number(v.stock ?? 0) > 0),
    );

  const filteredProducts = useMemo(() => {
    let items = catalogItems.filter((p: any) => p.isActive !== false);
    if (!isFood) {
      items = items.filter((p: any) => {
        const hasVariants = p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0;
        if (hasVariants) return sellableVariants(p).length > 0;
        return getProductPriceOrNull(p, activeTable) !== null && hasStock(p, null, stockEnabled);
      });
    } else {
      items = items.filter((p: any) => Number(p.price) > 0);
    }
    if (selectedCategory !== 'all') {
      items = items.filter((p: any) => p.categoryId === selectedCategory);
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      items = items.filter((p: any) => p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q));
    }
    return items;
  }, [catalogItems, selectedCategory, productSearch, activeTable, isFood]);

  // Ao trocar de cliente (tabela de preço), remove/reprecifica itens já escolhidos.
  useEffect(() => {
    setOrderItems(prev => {
      if (prev.length === 0) return prev;
      let removed = 0;
      const next: CartItem[] = [];
      for (const it of prev) {
        const product: any = catalogItems.find((p: any) => p.id === it.productId);
        if (!product) { next.push(it); continue; }
        let price: number | null;
        if (it.variantId) {
          const v = (product.variants || []).find((x: any) => x.id === it.variantId);
          price = getVariantPriceOrNull(v, activeTable);
        } else {
          price = priceOf(product);
        }
        if (price === null) { removed++; continue; }
        next.push(price === it.price ? it : { ...it, price });
      }
      if (removed > 0) {
        toast.error(`${removed} item(ns) sem preço na tabela ${activeTable} foram removidos do pedido.`);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable]);

  // Totals
  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = offersDelivery ? (store.settings.deliveryFee || 0) : 0;
  const { quantityDiscount, itemDiscounts } = useMemo(
    () => computeGroupDiscounts(orderItems, store.settings.discountRules || [], activeTable),
    [orderItems, store.settings.discountRules, activeTable],
  );
  const total = Math.max(0, subtotal - quantityDiscount) + deliveryFee;

  const getCustomerInfo = (): CustomerInfo => {
    if (customerMode === 'existing') {
      const cp = customerProfiles.find(c => c.id === selectedCustomerId);
      if (!cp) return customerForm;
      return {
        name: cp.name || '', cpfCnpj: cp.cpfCnpj || '', whatsapp: cp.whatsapp || '',
        cep: cp.cep || '', uf: cp.uf || '', city: cp.city || '',
        neighborhood: cp.neighborhood || '', address: cp.address || '',
        number: cp.number || '', complement: cp.complement || '',
      };
    }
    return customerForm;
  };

  const itemKey = (i: { productId: string; variantId?: string }) => `${i.productId}::${i.variantId || ''}`;

  const addProduct = (product: any) => {
    // If product has variants, open picker instead of adding directly
    if (!isFood && product.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
      setVariantPicker({ product });
      return;
    }
    const unitPrice = priceOf(product);
    if (unitPrice === null) {
      toast.error(`Produto sem preço na tabela ${activeTable} do cliente. Não é possível vender por outra tabela.`);
      return;
    }
    const check = wouldExceedMaterialApoio(orderItems, product.id, unitPrice, catalogItems as any, store.settings.materialApoio);
    if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
    const existing = orderItems.find(i => i.productId === product.id && !i.variantId);
    if (existing) {
      setOrderItems(items => items.map(i =>
        i.productId === product.id && !i.variantId ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems(items => [...items, {
        productId: product.id,
        name: product.name,
        code: isFood ? '' : (product.code || ''),
        price: unitPrice,
        quantity: 1,
        image: isFood ? product.image : product.image,
      }]);
    }
  };

  const addVariantToOrder = () => {
    if (!variantPicker) return;
    const { product, color, size } = variantPicker;
    const variants: any[] = sellableVariants(product);
    const uniqueColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean)));
    const uniqueSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean)));
    if (uniqueColors.length > 0 && !color) { toast.error('Selecione a cor'); return; }
    if (uniqueSizes.length > 0 && !size) { toast.error('Selecione o tamanho'); return; }
    const variant = variants.find(v =>
      (uniqueColors.length === 0 || v.color === color) &&
      (uniqueSizes.length === 0 || v.size === size)
    );
    if (!variant) { toast.error('Variante indisponível'); return; }
    const variantPrice = getVariantPriceOrNull(variant, activeTable);
    if (variantPrice === null) {
      toast.error(`Variação sem preço na tabela ${activeTable} do cliente.`);
      return;
    }
    const check = wouldExceedMaterialApoio(orderItems, product.id, variantPrice, catalogItems as any, store.settings.materialApoio);
    if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
    const existing = orderItems.find(i => i.productId === product.id && i.variantId === variant.id);
    if (existing) {
      setOrderItems(items => items.map(i =>
        i.productId === product.id && i.variantId === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems(items => [...items, {
        productId: product.id,
        variantId: variant.id,
        name: product.name,
        code: product.code || '',
        color: variant.color,
        size: variant.size,
        price: variantPrice,
        quantity: 1,
        image: product.image,
      }]);
    }
    setVariantPicker(null);
  };

  const updateQuantity = (key: string, delta: number) => {
    if (delta > 0) {
      const it = orderItems.find(i => itemKey(i) === key);
      if (it) {
        const check = wouldExceedMaterialApoio(orderItems, it.productId, it.price * delta, catalogItems as any, store.settings.materialApoio);
        if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
      }
    }
    setOrderItems(items => items.map(i => {
      if (itemKey(i) !== key) return i;
      const newQty = i.quantity + delta;
      return newQty <= 0 ? i : { ...i, quantity: newQty };
    }));
  };

  const removeItem = (key: string) => {
    setOrderItems(items => items.filter(i => itemKey(i) !== key));
  };

  const handleSubmit = async () => {
    const customer = getCustomerInfo();
    if (!customer.name.trim()) { toast.error('Informe o nome do cliente'); return; }
    if (orderItems.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    if (orderItems.some(i => !(Number(i.price) > 0))) {
      toast.error(`Há itens sem preço válido na tabela ${activeTable}. Remova-os antes de salvar.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const stampedItems = orderItems.map(it => {
        const key = `${it.productId}-${it.variantId || ''}`;
        const pct = itemDiscounts[key];
        return pct ? { ...it, discountPercent: pct } : it;
      });
      await createOrder.mutateAsync({
        storeId: store.id,
        customer,
        items: stampedItems,
        subtotal,
        discount: quantityDiscount,
        deliveryFee,
        total,
        paymentMethod,
        deliveryShift,
        observations: observations || undefined,
        status: 'pendente',
      });
      toast.success('Pedido criado com sucesso!');
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep('customer');
    setCustomerMode('existing');
    setSelectedCustomerId('');
    setCustomerSearch('');
    setCustomerForm({ name: '', cpfCnpj: '', whatsapp: '', cep: '', uf: '', city: '', neighborhood: '', address: '', number: '', complement: '' });
    setOrderItems([]);
    setProductSearch('');
    setSelectedCategory('all');
    setPaymentMethod('pix');
    setDeliveryShift('tarde');
    setObservations('');
    onOpenChange(false);
  };

  const canProceedFromCustomer = customerMode === 'existing' ? !!selectedCustomerId : !!customerForm.name.trim();

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Novo Pedido</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-2 mb-2">
          {(['customer', 'items', 'review'] as const).map((s, i) => (
            <Badge key={s} variant={step === s ? 'default' : 'outline'} className="cursor-pointer" onClick={() => {
              if (s === 'customer') setStep(s);
              if (s === 'items' && canProceedFromCustomer) setStep(s);
              if (s === 'review' && canProceedFromCustomer && orderItems.length > 0) setStep(s);
            }}>
              {i + 1}. {s === 'customer' ? 'Cliente' : s === 'items' ? 'Itens' : 'Revisão'}
            </Badge>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Customer */}
          {step === 'customer' && (
            <div className="space-y-4">
              <Tabs value={customerMode} onValueChange={(v) => setCustomerMode(v as any)}>
                <TabsList className="w-full">
                  <TabsTrigger value="existing" className="flex-1">Cliente Cadastrado</TabsTrigger>
                  <TabsTrigger value="new" className="flex-1"><UserPlus className="mr-1 h-4 w-4" /> Novo Cliente</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-3">
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por nome ou WhatsApp..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="pl-9" />
                  </div>
                  <ScrollArea className="h-[250px] border rounded-md">
                    {filteredCustomers.length === 0 ? (
                      <p className="p-4 text-sm text-center text-muted-foreground">Nenhum cliente encontrado</p>
                    ) : (
                      <div className="divide-y">
                        {filteredCustomers.map(c => (
                          <button key={c.id} className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${selectedCustomerId === c.id ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                            onClick={() => setSelectedCustomerId(c.id)}>
                            <p className="font-medium text-sm">{c.name || '—'}</p>
                            <p className="text-xs text-muted-foreground">{c.whatsapp || '—'} {c.city ? `• ${c.city}/${c.uf}` : ''}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="new" className="mt-3 space-y-3">
                  <div className="grid gap-1"><Label className="text-sm">Nome *</Label><Input value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value.toUpperCase() }))} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1"><Label className="text-sm">WhatsApp</Label><Input value={customerForm.whatsapp} onChange={e => setCustomerForm(f => ({ ...f, whatsapp: e.target.value }))} /></div>
                    <div className="grid gap-1"><Label className="text-sm">CPF/CNPJ</Label><Input value={customerForm.cpfCnpj} onChange={e => setCustomerForm(f => ({ ...f, cpfCnpj: e.target.value }))} /></div>
                  </div>
                  {offersDelivery && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1"><Label className="text-sm">Cidade</Label><Input value={customerForm.city} onChange={e => setCustomerForm(f => ({ ...f, city: e.target.value }))} /></div>
                        <div className="grid gap-1"><Label className="text-sm">UF</Label><Input value={customerForm.uf} onChange={e => setCustomerForm(f => ({ ...f, uf: e.target.value }))} /></div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2 grid gap-1"><Label className="text-sm">Endereço</Label><Input value={customerForm.address} onChange={e => setCustomerForm(f => ({ ...f, address: e.target.value }))} /></div>
                        <div className="grid gap-1"><Label className="text-sm">Nº</Label><Input value={customerForm.number} onChange={e => setCustomerForm(f => ({ ...f, number: e.target.value }))} /></div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>

              <div className="flex justify-end">
                <Button onClick={() => setStep('items')} disabled={!canProceedFromCustomer}>Próximo →</Button>
              </div>
            </div>
          )}

          {/* Step 2: Items */}
          {step === 'items' && (
            <div className="space-y-4">
              {!isFood && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Tabela de preço {activeTable}</Badge>
                  <span>Somente produtos com preço nesta tabela podem ser vendidos.</span>
                </div>
              )}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar produto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} className="pl-9" />
                </div>
                {categories.length > 0 && (
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="max-h-[300px] overflow-y-auto border rounded-md">
                {filteredProducts.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">Nenhum produto encontrado</p>
                ) : (
                  <div className="divide-y">
                    {filteredProducts.map((p: any) => {
                      const hasVariants = !isFood && p.hasVariants && Array.isArray(p.variants) && sellableVariants(p).length > 0;
                      const inCart = !hasVariants ? orderItems.find(i => i.productId === p.id && !i.variantId) : null;
                      const variantPrices = hasVariants
                        ? sellableVariants(p).map(v => getVariantPriceOrNull(v, activeTable) as number)
                        : [];
                      const minPrice = hasVariants ? Math.min(...variantPrices) : (priceOf(p) ?? 0);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {hasVariants ? `A partir de ${formatCurrency(minPrice)}` : formatCurrency(minPrice)}
                            </p>
                          </div>
                          {inCart ? (
                            <div className="flex items-center gap-1">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(itemKey(inCart), -1)}><Minus className="h-3 w-3" /></Button>
                              <span className="w-6 text-center text-sm font-medium">{inCart.quantity}</span>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(itemKey(inCart), 1)}><Plus className="h-3 w-3" /></Button>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => addProduct(p)}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cart summary */}
              {orderItems.length > 0 && (
                <div className="border rounded-md p-3 space-y-2">
                  <p className="text-sm font-semibold">Itens selecionados ({orderItems.length})</p>
                  {orderItems.map(item => (
                    <div key={itemKey(item)} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">
                        {item.quantity}x {item.name}
                        {(item.size || item.color) && (
                          <span className="text-muted-foreground"> — {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{formatCurrency(item.price * item.quantity)}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(itemKey(item))}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('customer')}>← Voltar</Button>
                <Button onClick={() => setStep('review')} disabled={orderItems.length === 0}>Próximo →</Button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Customer summary */}
              <div className="border rounded-md p-3">
                <p className="text-sm font-semibold mb-1">Cliente</p>
                {(() => {
                  const c = getCustomerInfo();
                  return (
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{c.name}</p>
                      {c.whatsapp && <p>{c.whatsapp}</p>}
                      {c.city && <p>{c.city}/{c.uf}</p>}
                    </div>
                  );
                })()}
              </div>

              {/* Items summary */}
              <div className="border rounded-md p-3 space-y-1">
                <p className="text-sm font-semibold mb-1">Itens</p>
                {orderItems.map(item => (
                  <div key={itemKey(item)} className="flex justify-between text-sm">
                    <span>
                      {item.quantity}x {item.name}
                      {(item.size || item.color) && (
                        <span className="text-muted-foreground"> — {[item.size, item.color].filter(Boolean).join(' / ')}</span>
                      )}
                    </span>
                    <span>{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                  {deliveryFee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Taxa de entrega</span><span>{formatCurrency(deliveryFee)}</span></div>}
                  <div className="flex justify-between font-bold text-base border-t pt-1"><span>Total</span><span>{formatCurrency(total)}</span></div>
                </div>
              </div>

              {/* Payment */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Pagamento</Label>
                <RadioGroup value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)} className="flex flex-wrap gap-3">
                  {store.settings.acceptPix && <div className="flex items-center gap-1.5"><RadioGroupItem value="pix" id="np-pix" /><Label htmlFor="np-pix" className="cursor-pointer text-sm">PIX</Label></div>}
                  {store.settings.acceptBoleto && <div className="flex items-center gap-1.5"><RadioGroupItem value="boleto" id="np-boleto" /><Label htmlFor="np-boleto" className="cursor-pointer text-sm">Boleto</Label></div>}
                  {store.settings.acceptCard && <div className="flex items-center gap-1.5"><RadioGroupItem value="cartao" id="np-cartao" /><Label htmlFor="np-cartao" className="cursor-pointer text-sm">Cartão</Label></div>}
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="dinheiro" id="np-dinheiro" /><Label htmlFor="np-dinheiro" className="cursor-pointer text-sm">Dinheiro</Label></div>
                </RadioGroup>
              </div>

              {/* Delivery shift */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Turno de Entrega</Label>
                <RadioGroup value={deliveryShift} onValueChange={v => setDeliveryShift(v as DeliveryShift)} className="flex gap-3">
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="manha" id="np-manha" /><Label htmlFor="np-manha" className="cursor-pointer text-sm">Manhã</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="tarde" id="np-tarde" /><Label htmlFor="np-tarde" className="cursor-pointer text-sm">Tarde</Label></div>
                  <div className="flex items-center gap-1.5"><RadioGroupItem value="noite" id="np-noite" /><Label htmlFor="np-noite" className="cursor-pointer text-sm">Noite</Label></div>
                </RadioGroup>
              </div>

              {/* Observations */}
              <div className="grid gap-1">
                <Label className="text-sm font-semibold">Observações</Label>
                <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Observações adicionais..." rows={2} />
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep('items')}>← Voltar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Criando...' : 'Criar Pedido'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* Variant picker sub-dialog */}
    <Dialog open={!!variantPicker} onOpenChange={(v) => { if (!v) setVariantPicker(null); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{variantPicker?.product.name}</DialogTitle>
        </DialogHeader>
        {variantPicker && (() => {
          const variants: any[] = sellableVariants(variantPicker.product);
          const priceOfVariant = (v: any) => getVariantPriceOrNull(v, activeTable) ?? 0;
          const uniqueColors = Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
          const uniqueSizes = Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
          const matching = variants.find(v =>
            (uniqueColors.length === 0 || v.color === variantPicker.color) &&
            (uniqueSizes.length === 0 || v.size === variantPicker.size)
          );
          return (
            <div className="space-y-4">
              {uniqueColors.length > 0 && (
                <div>
                  <Label className="text-sm mb-2 block">Cor</Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueColors.map(c => {
                      const v = variants.find(x => x.color === c);
                      return (
                        <Button key={c} type="button" size="sm"
                          variant={variantPicker.color === c ? 'default' : 'outline'}
                          onClick={() => setVariantPicker(p => p ? { ...p, color: c, size: undefined } : p)}>
                          {c}{uniqueSizes.length === 0 && v ? ` · ${formatCurrency(priceOfVariant(v))}` : ''}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              {uniqueSizes.length > 0 && (
                <div>
                  <Label className="text-sm mb-2 block">Tamanho</Label>
                  <div className="flex flex-wrap gap-2">
                    {uniqueSizes.map(s => {
                      const v = variants.find(x =>
                        x.size === s && (uniqueColors.length === 0 || x.color === variantPicker.color)
                      );
                      const disabled = uniqueColors.length > 0 && !variantPicker.color;
                      return (
                        <Button key={s} type="button" size="sm" disabled={disabled || !v}
                          variant={variantPicker.size === s ? 'default' : 'outline'}
                          onClick={() => setVariantPicker(p => p ? { ...p, size: s } : p)}>
                          {s}{v ? ` · ${formatCurrency(priceOfVariant(v))}` : ''}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-semibold">
                  {matching ? formatCurrency(priceOfVariant(matching)) : '—'}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setVariantPicker(null)}>Cancelar</Button>
                  <Button size="sm" onClick={addVariantToOrder} disabled={!matching}>
                    <Plus className="h-3 w-3 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
    </>
  );
}
