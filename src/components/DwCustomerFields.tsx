import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DW_FIELD_GROUPS } from '@/lib/dwCustomerFields';

export function DwCustomerFields({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const [open, setOpen] = useState(false);
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-2 pt-2 border-t">
      <button type="button" className="flex items-center gap-1 text-sm font-semibold text-left" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Dados completos do ERP (padrão DW)
      </button>
      {open && DW_FIELD_GROUPS.map(g => (
        <div key={g.title} className="grid gap-2">
          <p className="text-xs font-medium text-muted-foreground">{g.title}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.fields.map(f => (
              <div key={f.key} className={`grid gap-1 ${f.key === 'observacao' ? 'col-span-2' : ''}`}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === 'frete' || f.type === 'pfpj' ? (
                  <select className="h-10 rounded-md border border-input bg-background px-2 text-sm" value={value[f.key] || ''} onChange={e => set(f.key, e.target.value)}>
                    <option value="">—</option>
                    {f.type === 'frete'
                      ? <><option value="0">0 - CIF (frete por conta da empresa)</option><option value="1">1 - FOB (frete por conta do cliente)</option></>
                      : <><option value="0">Física</option><option value="1">Jurídica</option></>}
                  </select>
                ) : (
                  <Input type={f.type === 'date' ? 'date' : 'text'} value={value[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
