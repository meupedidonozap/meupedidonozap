import { useEffect, useState } from 'react';
import { UserCog, RefreshCw, MapPin, LogOut as LogOutIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SellerCustomerDialog from '@/components/SellerCustomerDialog';
import CheckinDialog from '@/components/CheckinDialog';
import type { SellerCustomer } from '@/contexts/SellerContext';
import { resolveStorePriceTable } from '@/lib/pricing';
import { useOpenVisit, formatDuration, DEFAULT_VISIT_REASONS } from '@/hooks/useCustomerVisits';

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
  };
}

export default function SellerModeBar({
  storeId, storeSlug, sellerCodes, selectedCustomer, onSelect, onChangeCustomer, salesForce,
}: Props) {
  const [open, setOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

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
                {selectedCustomer.customerCode ? ` (#${selectedCustomer.customerCode})` : ''}
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
        }}
      />

      {salesForceOn && (
        <CheckinDialog
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          storeId={storeId}
          sellerCodes={sellerCodes}
          unvisitedPeriodDays={salesForce?.unvisitedPeriodDays ?? 30}
          visitReasons={salesForce?.visitReasons?.length ? salesForce.visitReasons : DEFAULT_VISIT_REASONS}
          maxDistanceMeters={salesForce?.maxCheckinDistanceMeters ?? 300}
          onCustomerSelected={(c) => {
            if (selectedCustomer && selectedCustomer.id !== c.id) onChangeCustomer?.();
            onSelect(c);
          }}
        />
      )}
    </>
  );
}
