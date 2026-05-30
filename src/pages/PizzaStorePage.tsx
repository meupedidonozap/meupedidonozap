import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { buildStoreJsonLd } from '@/lib/seoSchemas';
import { useParams, Link } from 'react-router-dom';
import {
  Search, ShoppingCart, Plus, Minus, X, ChevronDown, ChevronUp,
  Share2, Loader2, User, LogIn, LogOut, ShoppingBag, Pizza, UtensilsCrossed, Wine,
  List, LayoutGrid,
} from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import CustomerAuthDialog from '@/components/CustomerAuthDialog';
import ClosedBanner from '@/components/ClosedBanner';
import { getWaiterSession } from '@/components/WaiterModeFAB';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCategories } from '@/hooks/useCategories';
import { useFoodItems } from '@/hooks/useFoodItems';
import { usePizzaSizes, usePizzaFlavors } from '@/hooks/usePizzaData';
import type { FoodItem, PizzaSize, PizzaFlavor } from '@/types';
import { useCart } from '@/contexts/CartContext';
import { formatCurrency } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

/* ─── Pizza Builder Dialog ─── */
function PizzaBuilderDialog({
  open, onOpenChange, sizes, flavors, categories, onAddToCart,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sizes: PizzaSize[];
  flavors: PizzaFlavor[];
  categories: { id: string; name: string }[];
  onAddToCart: (size: PizzaSize, selectedFlavors: PizzaFlavor[]) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(null);
  const [selectedFlavors, setSelectedFlavors] = useState<PizzaFlavor[]>([]);

  useEffect(() => {
    if (open) { setSelectedSize(null); setSelectedFlavors([]); }
  }, [open]);

  const maxFlavors = selectedSize?.maxFlavors || 0;

  const toggleFlavor = (flavor: PizzaFlavor) => {
    setSelectedFlavors(prev => {
      if (prev.find(f => f.id === flavor.id)) return prev.filter(f => f.id !== flavor.id);
      if (prev.length >= maxFlavors) return prev;
      return [...prev, flavor];
    });
  };

  const flavorsByCategory = useMemo(() => {
    const grouped: Record<string, PizzaFlavor[]> = {};
    const uncategorized: PizzaFlavor[] = [];
    flavors.forEach(f => {
      if (f.categoryId) {
        if (!grouped[f.categoryId]) grouped[f.categoryId] = [];
        grouped[f.categoryId].push(f);
      } else {
        uncategorized.push(f);
      }
    });
    return { grouped, uncategorized };
  }, [flavors]);

  const canAdd = selectedSize && selectedFlavors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-[#1a1a2e] border-orange-500/30 text-white sm:max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl text-orange-400 flex items-center gap-2">
            <Pizza className="h-6 w-6" /> Monte sua Pizza
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Size */}
        <div>
          <h3 className="text-sm font-semibold text-orange-300 mb-2">1. Escolha o tamanho</h3>
          <div className="grid grid-cols-2 gap-2">
            {sizes.map(size => (
              <button
                key={size.id}
                onClick={() => { setSelectedSize(size); setSelectedFlavors([]); }}
                className={`rounded-lg border p-3 text-left transition-all ${
                  selectedSize?.id === size.id
                    ? 'border-orange-500 bg-orange-500/20 ring-1 ring-orange-500'
                    : 'border-white/10 bg-white/5 hover:border-orange-500/50'
                }`}
              >
                <span className="font-bold text-sm">{size.name}</span>
                <div className="text-xs text-gray-400 mt-0.5">até {size.maxFlavors} sabor{size.maxFlavors > 1 ? 'es' : ''}</div>
                <div className="text-orange-400 font-bold mt-1">{formatCurrency(size.price)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Flavors */}
        {selectedSize && (
          <div>
            <h3 className="text-sm font-semibold text-orange-300 mb-1">
              2. Escolha {maxFlavors === 1 ? 'o sabor' : `até ${maxFlavors} sabores`}
              <span className="ml-2 text-xs text-gray-400">({selectedFlavors.length}/{maxFlavors})</span>
            </h3>
            <ScrollArea className="max-h-[35vh]">
              {/* Uncategorized */}
              {flavorsByCategory.uncategorized.length > 0 && (
                <div className="space-y-1 mb-2">
                  {flavorsByCategory.uncategorized.map(flavor => {
                    const selected = !!selectedFlavors.find(f => f.id === flavor.id);
                    const disabled = !selected && selectedFlavors.length >= maxFlavors;
                    return (
                      <label key={flavor.id} className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${selected ? 'bg-orange-500/20' : disabled ? 'opacity-40' : 'hover:bg-white/5'}`}>
                        <Checkbox checked={selected} disabled={disabled} onCheckedChange={() => toggleFlavor(flavor)} className="border-orange-500 data-[state=checked]:bg-orange-500" />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{flavor.name}</span>
                          {flavor.description && <p className="text-xs text-gray-400 line-clamp-1">{flavor.description}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {/* By category */}
              {Object.entries(flavorsByCategory.grouped).map(([catId, catFlavors]) => {
                const cat = categories.find(c => c.id === catId);
                return (
                  <div key={catId} className="mb-2">
                    <div className="text-xs font-semibold text-orange-300/70 uppercase tracking-wide px-2 py-1">{cat?.name || 'Outros'}</div>
                    <div className="space-y-1">
                      {catFlavors.map(flavor => {
                        const selected = !!selectedFlavors.find(f => f.id === flavor.id);
                        const disabled = !selected && selectedFlavors.length >= maxFlavors;
                        return (
                          <label key={flavor.id} className={`flex items-center gap-3 rounded-lg p-2 cursor-pointer transition-colors ${selected ? 'bg-orange-500/20' : disabled ? 'opacity-40' : 'hover:bg-white/5'}`}>
                            <Checkbox checked={selected} disabled={disabled} onCheckedChange={() => toggleFlavor(flavor)} className="border-orange-500 data-[state=checked]:bg-orange-500" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{flavor.name}</span>
                              {flavor.description && <p className="text-xs text-gray-400 line-clamp-1">{flavor.description}</p>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button
            disabled={!canAdd}
            onClick={() => { if (selectedSize && selectedFlavors.length > 0) { onAddToCart(selectedSize, selectedFlavors); onOpenChange(false); } }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
          >
            Adicionar ao Carrinho • {selectedSize ? formatCurrency(selectedSize.price) : '---'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Menu Item Card (Appetizers, Sides, Drinks) ─── */
function MenuItemCard({ item, quantity, onAdd, onUpdate }: {
  item: FoodItem; quantity: number;
  onAdd: () => void; onUpdate: (q: number) => void;
}) {
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10 text-white hover:border-orange-500/30 transition-colors">
      <CardContent className="flex gap-3 p-3">
        {item.image && (
          <div className="h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden bg-white">
            <img src={item.image} alt={item.name} className="h-full w-full object-contain p-1" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{item.name}</h3>
          {item.description && <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{item.description}</p>}
          <p className="text-orange-400 font-bold mt-1">{formatCurrency(item.price)}</p>
        </div>
        <div className="flex items-end">
          {quantity > 0 ? (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7 border-orange-500/50 text-orange-400 hover:bg-orange-500/20" onClick={() => onUpdate(quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center text-sm font-bold">{quantity}</span>
              <Button size="icon" className="h-7 w-7 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => onUpdate(quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs" onClick={onAdd}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Menu Item Grid Card ─── */
function MenuItemGridCard({ item, quantity, onAdd, onUpdate }: {
  item: FoodItem; quantity: number;
  onAdd: () => void; onUpdate: (q: number) => void;
}) {
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10 text-white hover:border-orange-500/30 transition-colors">
      <div className="aspect-square overflow-hidden bg-white">
        {item.image ? (
          <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain p-1" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">Sem foto</div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="text-sm font-semibold line-clamp-2">{item.name}</h3>
        <p className="text-orange-400 font-bold mt-1">{formatCurrency(item.price)}</p>
        <div className="mt-2 flex justify-end">
          {quantity > 0 ? (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-7 w-7 border-orange-500/50 text-orange-400 hover:bg-orange-500/20" onClick={() => onUpdate(quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-5 text-center text-sm font-bold">{quantity}</span>
              <Button size="icon" className="h-7 w-7 bg-orange-500 hover:bg-orange-600 text-white" onClick={() => onUpdate(quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button size="icon" className="h-8 w-8 bg-orange-500 hover:bg-orange-600 text-white" onClick={onAdd}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function PizzaStorePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { data: categories = [] } = useCategories(store?.id);
  const { data: allFoodItems = [] } = useFoodItems(store?.id);
  const { data: sizes = [] } = usePizzaSizes(store?.id);
  const { data: flavors = [] } = usePizzaFlavors(store?.id);
  const { cart, setStoreId, addItem, updateQuantity } = useCart();
  const { user, signOut } = useAuth();
  const { data: customerProfile } = useCustomerProfile(user?.id, store?.id);

  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [pizzaDialogOpen, setPizzaDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('pizzas');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  useEffect(() => { if (store) setStoreId(store.id); }, [store, setStoreId]);

  const sections = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    const filter = (items: FoodItem[]) => searchTerm
      ? items.filter(i => i.name.toLowerCase().includes(lowerSearch) || i.description.toLowerCase().includes(lowerSearch))
      : items;

    const byCat: Record<string, FoodItem[]> = {};
    categories.forEach(c => { byCat[c.id] = []; });
    allFoodItems.forEach(item => {
      if (item.categoryId && byCat[item.categoryId]) byCat[item.categoryId].push(item);
    });

    return categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      items: filter(byCat[cat.id] || []),
    })).filter(s => s.items.length > 0);
  }, [categories, allFoodItems, searchTerm]);

  const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const getItemQuantity = (itemId: string) => cart.items.find(i => i.productId === itemId)?.quantity || 0;

  const handleAddFoodItem = (item: FoodItem) => {
    addItem({ productId: item.id, name: item.name, code: item.id, price: item.price, quantity: 1, image: item.image });
    toast.success('Item adicionado!');
  };

  const handleAddPizza = (size: PizzaSize, selectedFlavors: PizzaFlavor[]) => {
    const flavorNames = selectedFlavors.map(f => f.name).join(' / ');
    const name = `Pizza ${size.name} - ${flavorNames}`;
    const uniqueId = `pizza-${size.id}-${selectedFlavors.map(f => f.id).sort().join('-')}`;
    addItem({ productId: uniqueId, name, code: uniqueId, price: size.price, quantity: 1 });
    toast.success('Pizza adicionada ao carrinho!');
  };

  if (storeLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#0f0f23]"><Loader2 className="h-8 w-8 animate-spin text-orange-400" /></div>;
  }

  if (!store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f23] text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Loja não encontrada</h1>
          <Button asChild className="mt-4 bg-orange-500"><Link to="/">Voltar</Link></Button>
        </div>
      </div>
    );
  }

  const sectionTabs = [
    { id: 'pizzas', label: 'Pizzas', icon: Pizza },
    ...sections.map(s => ({ id: s.id, label: s.name, icon: UtensilsCrossed })),
  ];

  return (
    <div className="min-h-screen bg-[#0f0f23] text-white pb-24">
      <Helmet>
        <title>{store.name} | MeuPedidoNoZap</title>
        <meta name="description" content={`Peça sua pizza em ${store.name}. Delivery rápido via WhatsApp.`} />
        <link rel="canonical" href={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:title" content={store.name} />
        <meta property="og:description" content={`Peça sua pizza em ${store.name}`} />
        <meta property="og:image" content={store.logo || store.banner || 'https://meupedidonozap.lovable.app/placeholder.svg'} />
        <meta property="og:url" content={`https://meupedidonozap.lovable.app/${store.slug}`} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(buildStoreJsonLd(store))}</script>
      </Helmet>

      <header className="sticky top-0 z-40 border-b border-orange-500/20 bg-[#1a1a2e]/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            {store.logo && <img src={store.logo} alt="" className="h-8 w-8 rounded-full object-cover" />}
            <h1 className="text-lg font-bold text-orange-400">{store.name}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-gray-300 hover:text-orange-400 hover:bg-white/10">
              <Search className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="text-gray-300 hover:text-orange-400 hover:bg-white/10"
              title={viewMode === 'list' ? 'Ver em grade' : 'Ver em lista'}
            >
              {viewMode === 'list' ? <LayoutGrid className="h-5 w-5" /> : <List className="h-5 w-5" />}
            </Button>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-gray-300 hover:text-orange-400 hover:bg-white/10">
                    <User className="h-5 w-5" />
                    <span className="text-sm max-w-[80px] truncate">{customerProfile?.name?.split(' ')[0] || 'Perfil'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-orange-500/30 text-white">
                  <DropdownMenuItem className="text-xs text-gray-400" disabled>{user.email}</DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/${store.slug}/pedidos`} className="gap-2"><ShoppingBag className="h-4 w-4" /> Meus Pedidos</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()} className="gap-2 text-red-400"><LogOut className="h-4 w-4" /> Sair</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1 text-gray-300 hover:text-orange-400 hover:bg-white/10" onClick={() => setAuthDialogOpen(true)}>
                <LogIn className="h-4 w-4" /> Login
              </Button>
            )}
          </div>
        </div>
        {isSearchOpen && (
          <div className="container pb-3">
            <Input
              placeholder="Buscar no cardápio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              autoFocus
              className="bg-white/10 border-orange-500/30 text-white placeholder:text-gray-500 focus:border-orange-500"
            />
          </div>
        )}
      </header>

      <ClosedBanner store={store} />

      {store.banner && (
        <div className="relative h-40 overflow-hidden">
          <img src={store.banner} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f23] via-transparent" />
        </div>
      )}

      <div className="sticky top-14 z-30 bg-[#0f0f23] border-b border-white/5">
        <div className="container">
          <ScrollArea className="w-full" type="scroll">
            <div className="flex gap-1 py-2">
              {sectionTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </div>

      <main className="container py-4">
        {activeSection === 'pizzas' && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <Pizza className="mx-auto h-16 w-16 text-orange-400 mb-3" />
              <h2 className="text-2xl font-bold text-orange-400">Nossas Pizzas</h2>
              <p className="text-gray-400 mt-1">Escolha o tamanho e monte com seus sabores favoritos</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {sizes.map(size => (
                <Card key={size.id} className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20 text-white hover:border-orange-500/50 transition-colors">
                  <CardContent className="p-4 text-center">
                    <h3 className="font-bold text-lg">{size.name}</h3>
                    <p className="text-xs text-gray-400 mt-1">até {size.maxFlavors} sabor{size.maxFlavors > 1 ? 'es' : ''}</p>
                    <p className="text-orange-400 font-bold text-xl mt-2">{formatCurrency(size.price)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              onClick={() => setPizzaDialogOpen(true)}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold py-6 text-lg shadow-lg shadow-orange-500/25"
            >
              <Pizza className="h-6 w-6 mr-2" /> Montar Minha Pizza
            </Button>

            {flavors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Nossos Sabores</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {flavors.slice(0, 9).map(flavor => (
                    <div key={flavor.id} className="rounded-lg bg-white/5 border border-white/10 p-3">
                      <span className="text-sm font-medium">{flavor.name}</span>
                      {flavor.description && <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{flavor.description}</p>}
                    </div>
                  ))}
                  {flavors.length > 9 && (
                    <button onClick={() => setPizzaDialogOpen(true)} className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3 text-orange-400 text-sm font-medium hover:bg-orange-500/20">
                      +{flavors.length - 9} mais...
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {sections.map(section => {
          if (activeSection !== section.id) return null;
          return (
            <div key={section.id} className="space-y-3">
              <h2 className="text-xl font-bold text-orange-400 mb-4">{section.name}</h2>
              {viewMode === 'list' ? (
                <div className="space-y-3">
                  {section.items.map(item => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      quantity={getItemQuantity(item.id)}
                      onAdd={() => handleAddFoodItem(item)}
                      onUpdate={(q) => updateQuantity(item.id, q)}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {section.items.map(item => (
                    <MenuItemGridCard
                      key={item.id}
                      item={item}
                      quantity={getItemQuantity(item.id)}
                      onAdd={() => handleAddFoodItem(item)}
                      onUpdate={(q) => updateQuantity(item.id, q)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {activeSection !== 'pizzas' && sections.every(s => s.id !== activeSection) && (
          <div className="py-16 text-center">
            <Search className="mx-auto h-12 w-12 text-gray-600" />
            <h3 className="mt-4 text-lg font-semibold text-gray-400">Nenhum item encontrado</h3>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-orange-500/20 bg-[#1a1a2e]/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-around">
          <button onClick={() => setActiveSection('pizzas')} className="flex flex-col items-center gap-1 text-orange-400">
            <Pizza className="h-5 w-5" /><span className="text-xs">Cardápio</span>
          </button>
          {!getWaiterSession() && (
            <Link to={`/${store.slug}/checkout`} className="relative flex flex-col items-center gap-1 text-gray-400 hover:text-orange-400">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && <Badge className="absolute -right-2 -top-1 h-5 w-5 rounded-full bg-orange-500 p-0 text-xs text-white border-0">{totalItems}</Badge>}
              <span className="text-xs">Carrinho</span>
            </Link>
          )}
          <button onClick={() => { navigator.share?.({ url: window.location.href, title: store.name }).catch(() => {}); }} className="flex flex-col items-center gap-1 text-gray-400 hover:text-orange-400">
            <Share2 className="h-5 w-5" /><span className="text-xs">Compartilhar</span>
          </button>
        </div>
      </nav>

      {totalItems > 0 && !getWaiterSession() && (
        <div className="fixed bottom-20 left-0 right-0 z-40 p-4">
          <Button asChild className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 font-bold">
            <Link to={`/${store.slug}/checkout`}>
              <ShoppingCart className="h-5 w-5" /> Ver Carrinho ({totalItems} {totalItems === 1 ? 'item' : 'itens'}) • {formatCurrency(cart.total)}
            </Link>
          </Button>
        </div>
      )}

      <PizzaBuilderDialog
        open={pizzaDialogOpen}
        onOpenChange={setPizzaDialogOpen}
        sizes={sizes}
        flavors={flavors}
        categories={categories}
        onAddToCart={handleAddPizza}
      />
      <CustomerAuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
        storeId={store.id}
        storeSlug={store.slug}
      />
    </div>
  );
}
