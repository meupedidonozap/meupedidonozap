import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setEditingQuote } from '@/lib/quoteEditing';

/** Aviso exibido enquanto o vendedor edita um orçamento existente. */
export default function EditingQuoteBanner({ name, onCancel }: { name: string; onCancel?: () => void }) {
  return (
    <div className="border-b border-accent bg-accent/40">
      <div className="container flex items-center justify-between gap-2 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Pencil className="h-4 w-4" />
          <span><span className="font-semibold">Editando Orçamento</span> • {name}</span>
        </span>
        <Button size="sm" variant="ghost" onClick={() => { setEditingQuote(null); onCancel?.(); }}>
          <X className="mr-1 h-4 w-4" /> Cancelar edição
        </Button>
      </div>
    </div>
  );
}
