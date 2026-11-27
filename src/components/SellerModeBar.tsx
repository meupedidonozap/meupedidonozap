import { useEffect, useState } from 'react';
import { UserCog, RefreshCw, MapPin, LogOut as LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SellerCustomerDialog from '@/components/SellerCustomerDialog';
import CheckinDialog from '@/components/CheckinDialog';
import type { SellerCustomer } from '@/contexts/SellerContext';
import { resolveStorePriceTable } from '@/lib/pricing';
import { useOpenVisit, formatDuration, DEFAULT_VISIT_REASONS } from '@/hooks/useCustomerVisits';
import { hasOpenCustomerDraft } from '@/lib/customerDraft';
import { shouldOfferCheckin } from '@/lib/checkinPrompt';
import { getCurrentPosition, type Coords } from '@/lib/geo';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  storeId: string;
  storeSlug?: string;
  sellerCodes: string[];
  selectedCustomer: SellerCustomer | null;
  onSelect: (c: SellerCustomer) => void;
  /** Chamado ao trocar de cliente (para limpar o carrinho). */
  onChangeCustomer?: () => void;
  /** Força de vendas (somente lojas configuradas). */
  salesForce?: {
    enabled: boolean;
    unvisitedPeriodDays: number;
    visitReasons: string[];
    maxCheckinDistanceMeters: number;
    /** Perfil Vendedor (não televendas/gerente/admin): único que recebe a pergunta de check-in. */
    askOnSelect?: boolean;
  };
}

export default function SellerModeBar({
  storeId, storeSlug, sellerCodes, selectedCustomer, onSelect, onChangeCustomer, salesForce,
}: Props) {
  const [open, setOpen] = useState(() => hasOpenCustomerDraft(storeId));
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [askCheckin, setAskCheckin] = useState<SellerCustomer | null>(null);
  const [autoCheckin, setAutoCheckin] = useState<{ customerId: string; position: Promise<Coords> } | null>(null);

  const salesForceOn = !!salesForce?.enabled;
  const { data: openVisit } = useOpenVisit(salesForceOn ? storeId : undefined);

  useEffect(() => {
    if (!openVisit) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [openVisit]);

  const elapsed = openVisit
    ? Math.max(0, Math.round((now - new Date(openVisit.checked_in_at).getTime()) / 1000))
    : 0;

  return (
    <>
      <div className="border-b border-primary/30 bg-primary/10">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-2 text-sm">
            <UserCog className="h-4 w-4 text-primary" />
            {selectedCustomer ? (
              <span>
                <span className="font-semibold">Modo Vendedor</span> — pedido para{' '}
                <span className="font-semibold">{selectedCustomer.name}</span>
                {selectedCustomer.customerCode ? ` (#${selectedCustomer.customerCode})` : ' • PROSPECT'}
                {' '}• Tabela {resolveStorePriceTable(storeSlug, selectedCustomer.priceTable)}
              </span>
            ) : (
              <span><span className="font-semibold">Modo Vendedor</span> — selecione o cliente antes de montar o pedido</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {salesForceOn && (
              openVisit ? (
                <Button size="sm" variant="destructive" onClick={() => setCheckinOpen(true)}>
                  <LogOutIcon className="mr-1 h-4 w-4" /> Checkout · {formatDuration(elapsed)}
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setCheckinOpen(true)}>
                  <MapPin className="mr-1 h-4 w-4" /> Checkin
                </Button>
              )
            )}
            <Button size="sm" variant={selectedCustomer ? 'outline' : 'default'} onClick={() => setOpen(true)}>
              {selectedCustomer ? <><RefreshCw className="mr-1 h-4 w-4" /> Trocar cliente</> : 'Selecionar cliente'}
            </Button>
          </div>
        </div>
      </div>

      <SellerCustomerDialog
        open={open}
        onOpenChange={setOpen}
        storeId={storeId}
        storeSlug={storeSlug}
        sellerCodes={sellerCodes}
        onSelected={(c) => {
          if (selectedCustomer && selectedCustomer.id !== c.id) onChangeCustomer?.();
          onSelect(c);
          if (shouldOfferCheckin({ salesForceOn, isFieldSeller: !!salesForce?.askOnSelect, customerId: c.id, openVisitCustomerId: openVisit?.customer_profile_id })) setAskCheckin(c);
        }}
      />

      <AlertDialog open={!!askCheckin} onOpenChange={(o) => { if (!o) setAskCheckin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja fazer check-in agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Cliente selecionado: {askCheckin?.name}{askCheckin?.customerCode ? ` (#${askCheckin.customerCode})` : ' • PROSPECT'}. O check-in registra sua localização atual.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!askCheckin) return;
              // O GPS é pedido no próprio toque (exigência do Safari/iOS).
              const position = getCurrentPosition();
              position.catch(() => undefined);
              setAutoCheckin({ customerId: askCheckin.id, position });
              toast.info('Obtendo sua localização para o check-in...');
            }}>Sim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {salesForceOn && (
        <CheckinDialog
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          storeId={storeId}
          storeSlug={storeSlug}
          sellerCodes={sellerCodes}
          unvisitedPeriodDays={salesForce?.unvisitedPeriodDays ?? 30}
          visitReasons={salesForce?.visitReasons?.length ? salesForce.visitReasons : DEFAULT_VISIT_REASONS}
          maxDistanceMeters={salesForce?.maxCheckinDistanceMeters ?? 300}
          autoCheckin={autoCheckin}
          onAutoCheckinHandled={() => setAutoCheckin(null)}
          onCustomerSelected={(c) => {
            if (selectedCustomer && selectedCustomer.id !== c.id) onChangeCustomer?.();
            onSelect(c);
          }}
        />
      )}
    </>
  );
}
