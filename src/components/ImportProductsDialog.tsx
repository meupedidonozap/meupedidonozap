import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Category } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  categories: Category[];
}

interface ParsedRow {
  code: string;
  name: string;
  description: string;
  category: string;
  price: number;
  active: boolean;
  valid: boolean;
  error?: string;
}

const COLUMN_MAP: Record<string, keyof ParsedRow> = {
  codigo: 'code',
  code: 'code',
  nome: 'name',
  name: 'name',
  descricao: 'description',
  description: 'description',
  categoria: 'category',
  category: 'category',
  preco: 'price',
  price: 'price',
  ativo: 'active',
  active: 'active',
};

function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parsePrice(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[R$\s]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parseActive(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  const s = String(val).toLowerCase().trim();
  return !['nao', 'não', 'no', 'false', '0', 'inativo'].includes(s);
}

export default function ImportProductsDialog({ open, onOpenChange, storeId, categories }: ImportProductsDialogProps) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ imported: number; errors: number } | null>(null);

  const reset = useCallback(() => {
    setRows([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(ws);

        if (!json.length) {
          toast.error('Arquivo vazio ou sem dados válidos.');
          return;
        }

        // Map headers
        const sampleKeys = Object.keys(json[0]);
        const headerMap: Record<string, string> = {};
        for (const key of sampleKeys) {
          const normalized = normalizeKey(key);
          const mapped = COLUMN_MAP[normalized];
          if (mapped) headerMap[key] = mapped;
        }

        const parsed: ParsedRow[] = json.map((row) => {
          const get = (field: string) => {
            const originalKey = Object.keys(headerMap).find(k => headerMap[k] === field);
            return originalKey ? row[originalKey] : undefined;
          };

          const name = String(get('name') || '').trim();
          const price = parsePrice(get('price'));
          const valid = !!name && price > 0;

          return {
            code: String(get('code') || '').trim(),
            name,
            description: String(get('description') || '').trim(),
            category: String(get('category') || '').trim(),
            price,
            active: parseActive(get('active')),
            valid,
            error: !name ? 'Nome obrigatório' : price <= 0 ? 'Preço inválido' : undefined,
          };
        });

        setRows(parsed);
      } catch {
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [reset]);

  const handleImport = useCallback(async () => {
    const validRows = rows.filter(r => r.valid);
    if (!validRows.length) return;

    setImporting(true);
    setProgress(0);

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
    let imported = 0;
    let errors = 0;
    const BATCH = 50;

    for (let i = 0; i < validRows.length; i += BATCH) {
      const batch = validRows.slice(i, i + BATCH);
      const records = batch.map(r => ({
        store_id: storeId,
        code: r.code,
        name: r.name,
        description: r.description,
        category_id: categoryMap.get(r.category.toLowerCase().trim()) || null,
        base_price: r.price,
        is_active: r.active,
        has_variants: false,
      }));

      const { error } = await supabase.from('products').insert(records);
      if (error) {
        errors += batch.length;
      } else {
        imported += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setResult({ imported, errors });
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['products'] });

    if (imported > 0) toast.success(`${imported} produto(s) importado(s)!`);
    if (errors > 0) toast.error(`${errors} produto(s) com erro.`);
  }, [rows, categories, storeId, qc]);

  const validCount = rows.filter(r => r.valid).length;
  const invalidCount = rows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar Produtos via Excel
          </DialogTitle>
          <DialogDescription>
            Selecione um arquivo .xlsx ou .xls com as colunas: Nome, Preço, Código, Descrição, Categoria, Ativo.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <CheckCircle className="h-12 w-12 text-accent" />
            <p className="text-lg font-semibold">Importação concluída!</p>
            <p className="text-muted-foreground">
              {result.imported} importado(s) · {result.errors} erro(s)
            </p>
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          </div>
        ) : (
          <>
            {!rows.length && (
              <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-lg">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Selecione o arquivo Excel</p>
                <label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button asChild variant="outline">
                    <span>Escolher Arquivo</span>
                  </Button>
                </label>
              </div>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{rows.length} linha(s) encontrada(s)</span>
                  <Badge variant="default">{validCount} válida(s)</Badge>
                  {invalidCount > 0 && <Badge variant="destructive">{invalidCount} inválida(s)</Badge>}
                </div>

                <div className="flex-1 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Ativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 100).map((row, i) => (
                        <TableRow key={i} className={row.valid ? '' : 'bg-destructive/10'}>
                          <TableCell>
                            {row.valid ? (
                              <CheckCircle className="h-4 w-4 text-accent" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{row.code || '-'}</TableCell>
                          <TableCell>
                            <span>{row.name || <span className="text-destructive">Vazio</span>}</span>
                          </TableCell>
                          <TableCell>{row.category || '-'}</TableCell>
                          <TableCell>{row.price > 0 ? formatCurrency(row.price) : <span className="text-destructive">Inválido</span>}</TableCell>
                          <TableCell>{row.active ? 'Sim' : 'Não'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 100 && (
                    <p className="p-2 text-center text-sm text-muted-foreground">
                      Mostrando 100 de {rows.length} linhas
                    </p>
                  )}
                </div>

                {importing && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-center text-muted-foreground">Importando... {progress}%</p>
                  </div>
                )}
              </>
            )}

            {rows.length > 0 && !importing && (
              <DialogFooter>
                <Button variant="outline" onClick={() => { reset(); }}>
                  Trocar Arquivo
                </Button>
                <Button onClick={handleImport} disabled={validCount === 0} className="gap-2">
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Importar {validCount} produto(s)
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Small Badge helper used inline
function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'destructive'; className?: string }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  const colors = variant === 'destructive' ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent';
  return <span className={`${base} ${colors} ${className}`}>{children}</span>;
}
