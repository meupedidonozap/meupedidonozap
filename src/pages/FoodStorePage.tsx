import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import {
  Home, Search, ShoppingCart, FileText, Plus, Minus, X,
  ChevronDown, ChevronUp, MapPin, Share2, Loader2, User, LogIn, LogOut, ShoppingBag,
  List, LayoutGrid, Menu,
} from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import ClosedBanner from '@/components/ClosedBanner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { useIngredients } from '@/hooks/useIngredients';
import { usePizzaBorders } from '@/hooks/usePizzaBorders';
import { useProductAssemblies } from '@/hooks/useProductAssembly';
import AssemblyDialog from '@/components/AssemblyDialog';
import type { Product, ProductAssembly } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

export default function FoodStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { data: categories = [] } = useCategories(store?.id);
  const { data: allProducts = [] } = useProducts(store?.id);
  const { data: ingredients = [] } = useIngredients(store?.id);
  const { data: borders = [] } = usePizzaBorders(store?.id);
  const { data: assemblies = [] } = useProductAssemblies(store?.id);
  const { cart, setStoreId, addItem, removeItem, updateQuantity, clearCart } = useCart();
  const { user, signOut } = useAuth();
  const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [assemblyProduct, setAssemblyProduct] = useState<Product | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  useEffect(() => {
    if (store) {
      setStoreId(store.id);
    }
  }, [store, setStoreId]);

  const activeProducts = useMemo(() => allProducts.filter(p => p.isActive), [allProducts]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return activeProducts
      .filter(item => {
        const matchesSearch = !term ||
          item.name.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term);
        const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeProducts, searchTerm, selectedCategory]);

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  const getAssembly = (productId: string): ProductAssembly | undefined =>
    assemblies.find(a => a.productId === productId);

  const needsAssembly = (p: Product): boolean => {
    const a = getAssembly(p.id);
    if (a && (a.mode !== 'fixed' || a.allowBorder || a.allowObservation)) return true;
    if (p.hasVariants && (p.variants?.length || 0) > 1) return true;
    return false;
  };

  const handleAddItem = (item: Product) => {
    if (needsAssembly(item)) {
      setAssemblyProduct(item);
      return;
    }
    addItem({
      productId: item.id,
      name: item.name,
      code: item.code || item.id,
      price: item.basePrice,
      quantity: 1,
      image: item.image,
    });
    toast.success('Item adicionado!');
  };

  const getItemQuantity = (itemId: string) =>
    cart.items.filter(i => i.productId === itemId).reduce((s, i) => s + i.quantity, 0);

  if (storeLoading) {
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{store.name} | MeuPedidoNoZap</title>
        <meta name="description" content={`Faça seu pedido em ${store.name}. ${store.address || 'Peça online via WhatsApp.'}`} />
        <link rel="canonical" href={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:title" content={store.name} />
        <meta property="og:description" content={`Peça online via WhatsApp em ${store.name}`} />
        <meta property="og:image" content={store.logo || store.banner || 'https://meupedidonozap.lovable.app/placeholder.svg'} />
        <meta property="og:url" content={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:type" content="website" />
      </Helmet>
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Sheet open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 flex flex-col h-full">
                <SheetHeader><SheetTitle>Categorias</SheetTitle></SheetHeader>
                <ScrollArea className="flex-1 mt-6 -mr-4 pr-4">
                  <div className="space-y-1">
                    <button
                      onClick={() => { setSelectedCategory('all'); setIsCategoryOpen(false); }}
                      className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${selectedCategory === 'all' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    >
                      Todos os Produtos
                    </button>
                    {categories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => { setSelectedCategory(category.id); setIsCategoryOpen(false); }}
                        className={`w-full rounded-lg px-4 py-3 text-left transition-colors ${selectedCategory === category.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <h1 className="text-lg font-bold truncate">{store.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(!isSearchOpen)}>
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              title={viewMode === 'list' ? 'Ver em grade' : 'Ver em lista'}
            >
              {viewMode === 'list' ? <LayoutGrid className="h-5 w-5" /> : <List className="h-5 w-5" />}
            </Button>
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
            <Button variant="ghost" size="icon"><Share2 className="h-5 w-5" /></Button>
          </div>
        </div>
        {isSearchOpen && (
          <div className="container pb-3 animate-slide-up">
            <Input placeholder="Buscar item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} autoFocus />
          </div>
        )}
      </header>

      <ClosedBanner store={store} />

      <main className="container py-4">
        {viewMode === 'list' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredItems.map(item => {
                      const quantity = getItemQuantity(item.id);
                      return (
                        <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
                          <CardContent className="flex gap-4 p-4">
                            <div className="flex-1">
                              <h3 className="font-semibold">{item.name}</h3>
                              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                              <p className="mt-2 font-bold text-accent">
                                {item.hasVariants && (item.variants?.length || 0) > 0
                                  ? `A partir de ${formatCurrency(Math.min(...item.variants!.map(v => v.price)))}`
                                  : formatCurrency(item.basePrice)}
                              </p>
                            </div>
                            <div className="flex flex-col items-end justify-between">
                              {item.image && <img src={item.image} alt={item.name} className="h-20 w-20 rounded-lg object-contain bg-white" />}
                              <div className="mt-2">
                                {quantity > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                                      const line = [...cart.items].reverse().find(i => i.productId === item.id);
                                      if (line) updateQuantity(item.id, line.quantity - 1, line.variantId);
                                    }}>
                                      <Minus className="h-4 w-4" />
                                    </Button>
                                    <span className="w-6 text-center font-medium">{quantity}</span>
                                    <Button size="icon" className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleAddItem(item)}>
                                      <Plus className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button size="icon" className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleAddItem(item)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filteredItems.map(item => {
                      const quantity = getItemQuantity(item.id);
                      return (
                        <Card key={item.id} className="overflow-hidden transition-shadow hover:shadow-md">
                          <div className="aspect-square overflow-hidden bg-white">
                            {item.image ? (
                              <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain p-1" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">Sem foto</div>
                            )}
                          </div>
                          <CardContent className="p-3">
                            <h3 className="text-sm font-semibold line-clamp-3">{item.name}</h3>
                            <p className="mt-1 font-bold text-accent">
                              {item.hasVariants && (item.variants?.length || 0) > 0
                                ? `A partir de ${formatCurrency(Math.min(...item.variants!.map(v => v.price)))}`
                                : formatCurrency(item.basePrice)}
                            </p>
                            <div className="mt-2 flex justify-end">
                              {quantity > 0 ? (
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => {
                                    const line = [...cart.items].reverse().find(i => i.productId === item.id);
                                    if (line) updateQuantity(item.id, line.quantity - 1, line.variantId);
                                  }}>
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-6 text-center text-sm font-medium">{quantity}</span>
                                  <Button size="icon" className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleAddItem(item)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button size="icon" className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => handleAddItem(item)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
          </div>
        )}
        {filteredItems.length === 0 && (
          <div className="py-16 text-center">
            <Search className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum item encontrado</h3>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card">
        <div className="container flex h-16 items-center justify-around">
          <Link to={`/${store.slug}`} className="flex flex-col items-center gap-1 text-accent">
            <Home className="h-5 w-5" /><span className="text-xs">Início</span>
          </Link>
          <Link to={`/${store.slug}/admin`} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground">
            <FileText className="h-5 w-5" /><span className="text-xs">Pedidos</span>
          </Link>
          <Link to={`/${store.slug}/checkout`} className="relative flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && <Badge className="absolute -right-2 -top-1 h-5 w-5 rounded-full bg-accent p-0 text-xs">{totalItems}</Badge>}
            <span className="text-xs">Carrinho</span>
          </Link>
        </div>
      </nav>

      {totalItems > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 p-4">
          <Button asChild className="w-full gap-2 bg-accent text-accent-foreground shadow-lg hover:bg-accent/90">
            <Link to={`/${store.slug}/checkout`}>
              <ShoppingCart className="h-5 w-5" /> Ver Carrinho ({totalItems} itens) • {formatCurrency(cart.total)}
            </Link>
          </Button>
        </div>
      )}
      <CustomerAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        storeId={store.id}
        storeSlug={store.slug}
      />
      {assemblyProduct && (() => {
        const a = getAssembly(assemblyProduct.id) || {
          productId: assemblyProduct.id,
          mode: 'fixed' as const,
          allowObservation: false,
          allowBorder: false,
          limitsByVariant: {},
          defaultIngredientIds: [],
        };
        const catFilter = assemblyProduct.categoryId;
        const ingForProduct = ingredients.filter(i =>
          i.categoryIds.length === 0 || (catFilter && i.categoryIds.includes(catFilter))
        );
        return (
          <AssemblyDialog
            open={!!assemblyProduct}
            onOpenChange={(o) => { if (!o) setAssemblyProduct(null); }}
            product={assemblyProduct}
            assembly={a}
            ingredients={ingForProduct}
            borders={borders}
            onConfirm={(item) => { addItem(item); toast.success('Item adicionado!'); }}
          />
        );
      })()}
    </div>
  );
}
