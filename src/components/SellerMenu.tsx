import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Home, Gem, HeartPulse, LineChart, Package, FileText, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';

interface Props {
  store: { slug: string; name: string; logo?: string | null };
  sellerName?: string;
}

export default function SellerMenu({ store, sellerName }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const base = `/${store.slug}/vendedor`;
  const items = [
    { to: `/${store.slug}`, label: 'Início', icon: Home },
    { to: `${base}/atendimento`, label: 'Atendimento', icon: Gem },
    { to: `${base}/vendas`, label: 'Vendas', icon: HeartPulse },
    { to: `${base}/resultados`, label: 'Resultados', icon: LineChart },
    { to: `/${store.slug}`, label: 'Catálogo de Produtos', icon: Package },
    { to: `${base}/notas`, label: 'Notas Fiscais', icon: FileText },
    { to: `${base}/titulos`, label: 'Títulos', icon: Receipt },
  ];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full px-3" aria-label="Menu do vendedor"><Menu className="h-4 w-4" /> Menu</Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="items-center border-b p-6 text-center">
          {store.logo && <img src={store.logo} alt={store.name} className="h-16 w-16 rounded-full bg-white object-contain" />}
          <SheetTitle className="text-base">{sellerName || 'Vendedor'}</SheetTitle>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </SheetHeader>
        <nav className="p-2">
          {items.map(i => (
            <Link key={i.label} to={i.to} onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-md px-4 py-3 text-sm hover:bg-muted">
              <i.icon className="h-5 w-5 text-muted-foreground" /> {i.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
