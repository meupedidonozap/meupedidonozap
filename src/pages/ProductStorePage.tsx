import { useState, useMemo, useEffect } from 'react';

import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import {
  Menu, Search, ShoppingCart, Grid, List, Plus, Minus, X,
  MapPin, Phone, Clock, Trash2, ArrowRight, Tag, Loader2,
  User, LogOut, ShoppingBag, LogIn,
} from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types';
import { useCart } from '@/contexts/CartContext';
import ClosedBanner from '@/components/ClosedBanner';
import { getWaiterSession } from '@/components/WaiterModeFAB';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import VariantDialog from '@/components/VariantDialog';
import { wouldExceedMaterialApoio, MATERIAL_APOIO_MSG } from '@/lib/materialApoio';
import {
  resolveProductPrice,
  resolveVariantPrice,
  getProductPriceOrNull,
  getVariantPriceOrNull,
  hasStock,
} from '@/lib/pricing';

export default function ProductStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { data: categories = [] } = useCategories(store?.id);
  const { data: allProducts = [] } = useProducts(store?.id);
  const { cart, itemDiscounts, setStoreId, addItem, removeItem, updateQuantity, clearCart, applyCoupon, removeCoupon, setDiscountRules, setCustomerPriceTable, revalidatePrices } = useCart();
  const { user, signOut } = useAuth();
  const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<{ color?: string; size?: string } | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  useEffect(() => {
    if (store) {
      setStoreId(store.id);
      setDiscountRules(store.settings.discountRules || []);
    }
  }, [store, setStoreId, setDiscountRules]);

  // Sync the customer's price table into the cart (default 4 for visitors/unknown).
  const activePriceTable: 1 | 4 | 9 = (customerProfile?.priceTable === 1 || customerProfile?.priceTable === 9)
    ? customerProfile.priceTable
    : 4;
  useEffect(() => {
    setCustomerPriceTable(activePriceTable);
  }, [activePriceTable, setCustomerPriceTable]);

  // Somente produtos com preço válido (> 0) na tabela do cliente.
  // Produtos com variação mantêm apenas as variações com preço válido.
  const purchasableProducts = useMemo(() => {
    const result: Product[] = [];
    for (const product of allProducts) {
      if (!product.isActive) continue;
      if (product.hasVariants && product.variants && product.variants.length > 0) {
        const variants = product.variants.filter(
          v => getVariantPriceOrNull(v, activePriceTable) !== null && Number(v.stock ?? 0) > 0,
        );
        if (variants.length === 0) continue;
        result.push(variants.length === product.variants.length ? product : { ...product, variants });
      } else {
        if (getProductPriceOrNull(product, activePriceTable) === null) continue;
        result.push(product);
      }
    }
    return result;
  }, [allProducts, activePriceTable]);

  // Mapa id->nome de categoria (permite consolidar categorias duplicadas por nome)
  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach(c => m.set(c.id, c.name));
    return m;
  }, [categories]);

  // Categorias que realmente possuem produtos disponíveis para este cliente
  const categoryNamesWithProducts = useMemo(() => {
    const s = new Set<string>();
    purchasableProducts.forEach(p => {
      const name = (categoryNameById.get(p.categoryId) || '').trim().toLowerCase();
      if (name) s.add(name);
    });
    return s;
  }, [purchasableProducts, categoryNameById]);

  // Lista de categorias única por nome (evita duplicatas no menu)
  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    return categories.filter(c => {
      const key = (c.name || '').trim().toLowerCase();
      if (!key || seen.has(key) || !categoryNamesWithProducts.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categories, categoryNamesWithProducts]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === 'all') return null;
    return (categoryNameById.get(selectedCategory) || '').trim().toLowerCase();
  }, [selectedCategory, categoryNameById]);

  const filteredProducts = useMemo(() => {
    return purchasableProducts.filter(product => {
      const matchesSearch =
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const prodCatName = (categoryNameById.get(product.categoryId) || '').trim().toLowerCase();
      const matchesCategory = !selectedCategoryName || prodCatName === selectedCategoryName;
      return matchesSearch && matchesCategory;
    });
  }, [purchasableProducts, searchTerm, selectedCategoryName, categoryNameById]);

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  // Remove do carrinho itens que deixaram de ter preço na tabela atual do cliente
  useEffect(() => {
    if (!allProducts.length || !cart.items.length) return;
    const invalid = cart.items.filter(item => {
      const product = purchasableProducts.find(p => p.id === item.productId);
      if (!product) return true;
      if (item.variantId) return !product.variants?.some(v => v.id === item.variantId);
      return false;
    });
    if (invalid.length === 0) {
      // Reprecifica itens salvos no navegador com a tabela atual do cliente
      revalidatePrices(allProducts as any);
      return;
    }
    invalid.forEach(item => removeItem(item.productId, item.variantId));
    toast.warning('Alguns itens não estão disponíveis para a sua tabela de preço e foram removidos.');
  }, [purchasableProducts, allProducts, cart.items, removeItem, revalidatePrices]);

  const handleAddToCart = (product: Product, variant?: { color?: string; size?: string }) => {
    const variantData = variant && product.hasVariants
      ? product.variants?.find(v => v.color === variant.color && v.size === variant.size)
      : null;
    // Resolve groupId: usa group_id do produto, senão usa o nome da categoria
    const category = categories.find(c => c.id === product.categoryId);
    const resolvedGroupId = product.groupId || category?.name || undefined;
    const unitPrice = variantData
      ? getVariantPriceOrNull(variantData, activePriceTable)
      : getProductPriceOrNull(product, activePriceTable);
    if (unitPrice === null) {
      toast.error('Este item não está disponível para a sua tabela de preço.');
      return;
    }
    if (!hasStock(product, variantData)) {
      toast.error('Produto sem estoque no momento.');
      return;
    }
    const check = wouldExceedMaterialApoio(
      cart.items,
      product.id,
      unitPrice,
      allProducts,
      store?.settings.materialApoio,
    );
    if (check.exceeds) {
      toast.error(MATERIAL_APOIO_MSG);
      return;
    }
    addItem({
      productId: product.id,
      variantId: variantData?.id,
      groupId: resolvedGroupId,
      name: product.name,
      code: product.code,
      color: variant?.color,
      size: variant?.size,
      price: unitPrice,
      quantity: 1,
      image: product.image,
    });
    toast.success('Produto adicionado ao carrinho!');
    setSelectedProduct(null);
    setSelectedVariant(null);
  };

  const handleProductClick = (product: Product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      setSelectedProduct(product);
      setSelectedVariant({});
    } else {
      handleAddToCart(product);
    }
  };

  const handleApplyCoupon = async () => {
    if (!store?.id || !couponInput.trim()) return;
    const { data, error } = await supabase.rpc('validate_coupon', {
      _store_id: store.id,
      _code: couponInput.trim(),
      _subtotal: cart.subtotal,
    });
    if (error) { toast.error('Erro ao validar cupom'); return; }
    const result = data as any;
    if (!result?.valid) {
      if (result?.reason === 'expired') toast.error('Cupom expirado');
      else if (result?.reason === 'exhausted') toast.error('Cupom esgotado');
      else if (result?.reason === 'min_order') toast.error(`Pedido mínimo de ${formatCurrency(Number(result.minOrderValue) || 0)} para este cupom`);
      else toast.error('Cupom inválido');
      return;
    }
    applyCoupon(result.code, Number(result.discount) || 0);
    toast.success('Cupom aplicado!');
    setCouponInput('');
  };

  const uniqueColors = selectedProduct?.variants
    ? [...new Set(selectedProduct.variants.map(v => v.color).filter(Boolean))]
    : [];
  const uniqueSizes = selectedProduct?.variants
    ? [...new Set(selectedProduct.variants.map(v => v.size).filter(Boolean))]
    : [];
  const availableSizes = selectedVariant?.color && selectedProduct?.variants
    ? selectedProduct.variants.filter(v => v.color === selectedVariant.color).map(v => v.size).filter(Boolean)
    : uniqueSizes;

  if (storeLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
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

    const jsonLdProducts = filteredProducts.slice(0, 50).map(product => ({
      "@type": "Product",
      name: product.name,
      description: product.description || product.name,
      sku: product.code,
      image: product.image || undefined,
      offers: {
        "@type": "Offer",
        price: product.basePrice.toFixed(2),
        priceCurrency: "BRL",
        availability: "https://schema.org/InStock",
        url: `https://meupedidonozap.online/${store.slug}`,
      },
    }));

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: store.name,
      url: `https://meupedidonozap.online/${store.slug}`,
      numberOfItems: jsonLdProducts.length,
      itemListElement: jsonLdProducts.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: p,
      })),
    };

    return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{store.name} | MeuPedidoNoZap</title>
        <meta name="description" content={`Faça seu pedido em ${store.name}. ${store.address || 'Peça online via WhatsApp.'}`} />
        <link rel="canonical" href={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:title" content={store.name} />
        <meta property="og:description" content={`Peça online via WhatsApp em ${store.name}`} />
        <meta property="og:image" content={store.logo || store.banner || 'https://meupedidonozap.lovable.app/placeholder.svg'} />
        <meta property="og:url" content={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card shadow-sm">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Sheet open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 flex flex-col h-full">
              <SheetHeader><SheetTitle>Categorias</SheetTitle></SheetHeader>
              <ScrollArea className="flex-1 mt-6 -mr-4 pr-4">
                <div className="space-y-1">
                  <button onClick={() => { setSelectedCategory('all'); setIsCategoryOpen(false); }}
                    className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                    Todos os Produtos
                  </button>
                  {uniqueCategories.map(category => (
                    <button key={category.id} onClick={() => { setSelectedCategory(category.id); setIsCategoryOpen(false); }}
                      className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${selectedCategory === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>
                      {category.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <Link to={`/${store.slug}`} className="min-w-0 flex items-center gap-2">
            {store.logo && (
              <img src={store.logo} alt={store.name} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" />
            )}
            <h1 className="text-lg font-bold truncate">{store.name}</h1>
          </Link>
          <div className="flex flex-shrink-0 items-center gap-1">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <User className="h-5 w-5" />
                    <span className="text-sm max-w-[100px] truncate">
                      {customerProfile?.name?.split(' ')[0] || 'Perfil'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{user.email}</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/${store.slug}/pedidos`} className="gap-2"><ShoppingBag className="h-4 w-4" /> Meus Pedidos</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-destructive"><LogOut className="h-4 w-4" /> Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => setAuthDialogOpen(true)}>
                <LogIn className="h-4 w-4" />
                <span className="text-sm">Faça Login</span>
              </Button>
            )}
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {totalItems > 0 && (
                  <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs">{totalItems}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="flex w-full flex-col sm:max-w-md">
              <SheetHeader className="flex-row items-center justify-between space-y-0">
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" /> Carrinho <Badge variant="secondary">{totalItems} itens</Badge>
                </SheetTitle>
                {cart.items.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive hover:text-destructive">
                    <Trash2 className="mr-1 h-4 w-4" /> Limpar
                  </Button>
                )}
              </SheetHeader>
              <div className="flex-1 overflow-auto py-4">
                {cart.items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
                    <ShoppingCart className="h-12 w-12 opacity-50" />
                    <p className="mt-4">Seu carrinho está vazio</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.items.map(item => {
                      const itemKey = `${item.productId}-${item.variantId || ''}`;
                      const discPct = itemDiscounts[itemKey] || 0;
                      const discountedPrice = discPct > 0 ? item.price * (1 - discPct / 100) : item.price;
                      return (
                        <Card key={`${item.productId}-${item.variantId || 'default'}`}>
                          <CardContent className="p-4">
                            <div className="flex gap-3">
                              {item.image && <img src={item.image} alt={item.name} className="h-16 w-16 rounded object-cover" />}
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{item.name}</p>
                                    {(item.color || item.size) && <p className="text-sm text-muted-foreground">{item.color} {item.size}</p>}
                                    <Badge variant="outline" className="mt-1 font-mono text-xs">{item.code}</Badge>
                                  </div>
                                  <button onClick={() => removeItem(item.productId, item.variantId)} className="text-muted-foreground hover:text-destructive">
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                  <div>
                                    {discPct > 0 ? (
                                      <div>
                                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(item.price)}</span>
                                        <Badge className="ml-1 text-xs bg-accent text-accent-foreground">-{discPct}%</Badge>
                                        <p className="font-semibold text-accent">{formatCurrency(discountedPrice)} un.</p>
                                      </div>
                                    ) : (
                                      <p className="font-semibold">{formatCurrency(item.price)} un.</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}>
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                                      const check = wouldExceedMaterialApoio(cart.items, item.productId, item.price, allProducts, store?.settings.materialApoio);
                                      if (check.exceeds) { toast.error(MATERIAL_APOIO_MSG); return; }
                                      updateQuantity(item.productId, item.quantity + 1, item.variantId);
                                    }}>
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {item.quantity} x {formatCurrency(discountedPrice)} = {formatCurrency(discountedPrice * item.quantity)}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
              {cart.items.length > 0 && (
                <div className="border-t pt-4">
                  <div className="mb-4">
                    {cart.couponCode ? (
                      <div className="flex items-center justify-between rounded-lg bg-accent/10 p-3">
                        <div className="flex items-center gap-2"><Tag className="h-4 w-4 text-accent" /><span className="font-medium">{cart.couponCode}</span></div>
                        <Button variant="ghost" size="sm" onClick={removeCoupon}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input placeholder="Cupom de desconto" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} />
                        <Button variant="outline" onClick={handleApplyCoupon}>Aplicar</Button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(cart.subtotal)}</span></div>
                    {cart.quantityDiscount > 0 && <div className="flex justify-between text-accent"><span>Desc. quantidade</span><span>-{formatCurrency(cart.quantityDiscount)}</span></div>}
                    {cart.couponDiscount > 0 && <div className="flex justify-between text-accent"><span>Cupom ({cart.couponCode})</span><span>-{formatCurrency(cart.couponDiscount)}</span></div>}
                    <div className="flex justify-between border-t pt-2 text-lg font-bold"><span>Total</span><span>{formatCurrency(cart.total)}</span></div>
                  </div>
                  {(() => {
                    const minOrder = store.settings?.minOrderValue || 0;
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
                  <SheetFooter className="mt-4 flex-col gap-2 sm:flex-col">
                    <Button onClick={() => setIsCartOpen(false)} variant="outline" className="w-full">Continuar Comprando</Button>
                    {(() => {
                      const minOrder = store.settings?.minOrderValue || 0;
                      const effectiveTotal = cart.subtotal - (cart.quantityDiscount || 0);
                      const belowMin = minOrder > 0 && effectiveTotal < minOrder;
                      return belowMin ? (
                        <Button disabled className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                          Finalizar Pedido <ArrowRight className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button asChild className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                          <Link to={`/${store.slug}/checkout`}>Finalizar Pedido <ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                      );
                    })()}
                  </SheetFooter>
                </div>
              )}
            </SheetContent>
          </Sheet>
          </div>
        </div>

        <div className="container pb-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar produto ou código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Button
              variant="outline"
              aria-label="Visualizar em lista"
              onClick={() => setViewMode('list')}
              className={`shrink-0 gap-1.5 px-2.5 text-xs font-semibold ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <List className="h-4 w-4" />
              LISTA
            </Button>
            <Button
              variant="outline"
              aria-label="Visualizar em quadros"
              onClick={() => setViewMode('grid')}
              className={`shrink-0 gap-1.5 px-2.5 text-xs font-semibold ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <Grid className="h-4 w-4" />
              QUADRO
            </Button>
          </div>
        </div>

        <div className="container pb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="cursor-pointer" onClick={() => setIsCategoryOpen(true)}>
              {selectedCategory === 'all' ? 'Todos os Produtos' : categories.find(c => c.id === selectedCategory)?.name}
            </Badge>
            <span className="text-sm text-muted-foreground">{filteredProducts.length} produtos</span>
          </div>
        </div>
      </header>

      <ClosedBanner store={store} />

      <main className="container py-4">
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {filteredProducts.map(product => (
              <Card key={product.id} className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white">
                    {product.image ? <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-contain" /> : <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">Sem foto</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="outline" className="mb-1 font-mono text-xs">{product.code}</Badge>
                    <h3 className="font-medium line-clamp-3">{product.name}</h3>
                    <p className="text-lg font-bold text-primary">{formatCurrency(resolveProductPrice(product, activePriceTable))}</p>
                    {!hasStock(product) && !product.hasVariants && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">ESGOTADO</Badge>
                    )}
                  </div>
                  {(product.hasVariants || hasStock(product)) && (
                    <Button size="icon" className="shrink-0 bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}><Plus className="h-5 w-5" /></Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filteredProducts.map(product => (
              <Card key={product.id} className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="aspect-square overflow-hidden bg-white">
                  {product.image ? <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-contain p-1" /> : <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">Sem foto</div>}
                </div>
                <CardContent className="p-3">
                  <Badge variant="outline" className="mb-1 font-mono text-xs">{product.code}</Badge>
                  <h3 className="text-sm font-medium line-clamp-3">{product.name}</h3>
                  {!hasStock(product) && !product.hasVariants && (
                    <Badge variant="destructive" className="mt-1 text-[10px]">ESGOTADO</Badge>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-bold text-primary">{formatCurrency(resolveProductPrice(product, activePriceTable))}</p>
                    {(product.hasVariants || hasStock(product)) && (
                      <Button size="icon" className="h-8 w-8 bg-primary hover:bg-primary/90" onClick={(e) => { e.stopPropagation(); handleProductClick(product); }}><Plus className="h-4 w-4" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredProducts.length === 0 && (
          <div className="py-16 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">Tente buscar por outro termo</p>
          </div>
        )}
      </main>

      {/* Variant Selection Dialog */}
      <VariantDialog
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        uniqueColors={uniqueColors as string[]}
        uniqueSizes={uniqueSizes as string[]}
        availableSizes={availableSizes as string[]}
        selectedVariant={selectedVariant}
        setSelectedVariant={setSelectedVariant}
        onAddToCart={handleAddToCart}
      />

      <footer className="border-t bg-card py-6">
        <div className="container">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><p>{store.address}</p></div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><p>{store.phone}</p></div>
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><p>Seg-Sex: 08:00-18:00</p></div>
          </div>
        </div>
      </footer>
      {totalItems > 0 && !isCartOpen && !getWaiterSession() && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card p-3 shadow-lg">
          <Button onClick={() => setIsCartOpen(true)} className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <ShoppingCart className="h-5 w-5" /> Ver Carrinho ({totalItems} {totalItems === 1 ? 'item' : 'itens'}) — {formatCurrency(cart.total)}
          </Button>
        </div>
      )}
      <CustomerAuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} storeId={store?.id || ''} storeSlug={store?.slug} />
    </div>
  );
}
