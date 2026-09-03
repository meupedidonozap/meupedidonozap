import { useState } from 'react';
import { UserCog, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SellerCustomerDialog from '@/components/SellerCustomerDialog';
import type { SellerCustomer } from '@/contexts/SellerContext';
import { resolveStorePriceTable } from '@/lib/pricing';

interface Props {
  storeId: string;
  storeSlug?: string;
  sellerCodes: string[];
  selectedCustomer: SellerCustomer | null;
  onSelect: (c: SellerCustomer) => void;
  /** Chamado ao trocar de cliente (para limpar o carrinho). */
  onChangeCustomer?: () => void;
}

export default function SellerModeBar({ storeId, storeSlug, sellerCodes, selectedCustomer, onSelect, onChangeCustomer }: Props) {
  const [open, setOpen] = useState(false);

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
          <Button size="sm" variant={selectedCustomer ? 'outline' : 'default'} onClick={() => setOpen(true)}>
            {selectedCustomer ? <><RefreshCw className="mr-1 h-4 w-4" /> Trocar cliente</> : 'Selecionar cliente'}
          </Button>
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
    </>
  );
}
