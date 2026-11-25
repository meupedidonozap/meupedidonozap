import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Users, MapPin, ShoppingBag, LineChart, Package, FileText, Receipt, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSellerMode } from '@/hooks/useSellerMode';
import { dicoloreMenuSections, dicoloreMenuPath } from '@/lib/dicoloreMenu';
import AppUpdateButton from './AppUpdateButton';

const definitions = {
  atendimento: { label: 'Atendimento', icon: MapPin },
  vendas: { label: 'Vendas', icon: ShoppingBag },
  clientes: { label: 'Clientes', icon: Users },
  resultados: { label: 'Resultados', icon: LineChart },
  catalogo: { label: 'Catálogo', icon: Package },
  pedidos: { label: 'Meus Pedidos', icon: ShoppingBag },
  notas: { label: 'Notas Fiscais', icon: FileText },
  titulos: { label: 'Títulos', icon: Receipt },
  admin: { label: 'Painel Admin', icon: Settings },
};

export default function DicoloreMenu({ store }: { store: { id: string; slug: string; name: string; logo?: string | null } }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const access = useSellerMode(store.id);
  if (store.slug !== 'dicolore') return null;
  const sections = dicoloreMenuSections({ authenticated: !!access.user, loading: access.loading, error: !!access.accessError, isStaff: access.isStaff, canAdmin: access.canAdmin });
  const roleLabel = access.isManager ? 'Gerente' : access.isAdmin ? 'Administrador' : access.isTelevendas ? 'Televendas' : access.isSeller ? 'Vendedor' : access.isStaff ? 'Equipe' : access.user ? 'Cliente' : '';
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-3" aria-label="Menu da loja" disabled={access.loading}>
          {access.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Menu className="h-4 w-4" />} Menu
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 max-w-[90vw] flex-col p-0">
        <SheetHeader className="shrink-0 items-center border-b p-5 text-center">
          {store.logo && <img src={store.logo} alt={store.name} className="h-16 w-16 object-contain" />}
          <SheetTitle>{store.name}</SheetTitle>
          {roleLabel && <p className="text-sm text-muted-foreground">{roleLabel}</p>}
          {access.sellerName && <p className="max-w-full break-words text-sm">{access.sellerName}</p>}
        </SheetHeader>
        <nav aria-label="Navegação da loja" className="min-h-0 flex-1 overflow-y-auto p-2">
          {sections.map(section => {
            const item = definitions[section];
            const to = dicoloreMenuPath(section, access.isStaff);
            return <Link key={section} to={to} onClick={() => setOpen(false)} aria-current={pathname === to ? 'page' : undefined} className="flex items-center gap-3 rounded-md px-4 py-3 text-sm hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold"><item.icon className="h-5 w-5 shrink-0 text-muted-foreground" />{item.label}</Link>;
          })}
          {access.accessError && <div role="alert" className="space-y-3 p-4 text-sm"><p>Não foi possível carregar seu acesso.</p><Button variant="outline" onClick={() => void access.retryAccess()}>Tentar novamente</Button></div>}
          <div className="mt-2 border-t pt-2"><AppUpdateButton menu /></div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}