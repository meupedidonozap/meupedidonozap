import { useState, useCallback } from 'react';
import * as XLSX from '@e965/xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import type { Category, StoreType } from '@/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, RefreshCw, Plus, Download } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

// ── Props ──

interface ImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  categories: Category[];
  storeType?: StoreType;
}

// ── Parsed types ──

interface ParsedRow {
  code: string;
  name: string;
  description: string;
  category: string;
  group: string;
  unit: string;
  price: number;
  price1: number;
  price9: number;
  priceRes: number;
  stock: number;
  active: boolean;
  valid: boolean;
  error?: string;
  action: 'insert' | 'update';
  existingId?: string;
}

interface VariantRow {
  color: string;
  size: string;
  price: number;
  stock: number;
  sku: string;
}

interface ParsedProductGroup {
  code: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  active: boolean;
  hasVariants: boolean;
  variants: VariantRow[];
  action: 'insert' | 'update';
  existingId?: string;
  valid: boolean;
  error?: string;
}

// ── Column mapping ──

const COLUMN_MAP: Record<string, string> = {
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
  preco1: 'price1',
  price1: 'price1',
  'preco 1': 'price1',
  tabela1: 'price1',
  'tabela 1': 'price1',
  preco9: 'price9',
  price9: 'price9',
  'preco 9': 'price9',
  tabela9: 'price9',
  'tabela 9': 'price9',
  precores: 'priceRes',
  'preco res': 'priceRes',
  'preco reservado': 'priceRes',
  tabelares: 'priceRes',
  'tabela res': 'priceRes',
  grupo: 'group',
  group: 'group',
  unidade: 'unit',
  unit: 'unit',
  un: 'unit',
  ativo: 'active',
  active: 'active',
  cor: 'color',
  color: 'color',
  tamanho: 'size',
  size: 'size',
  estoque: 'stock',
  stock: 'stock',
  sku: 'sku',
};

function normalizeKey(key: string): string {
  return key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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

function parseStock(val: any): number {
  if (typeof val === 'number') return Math.max(0, Math.round(val));
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

function parseActive(val: any): boolean {
  if (val === undefined || val === null || val === '') return true;
  const s = String(val).toLowerCase().trim();
  return !['nao', 'não', 'no', 'false', '0', 'inativo'].includes(s);
}

function buildHeaderMap(sampleKeys: string[]) {
  const headerMap: Record<string, string> = {};
  for (const key of sampleKeys) {
    const mapped = COLUMN_MAP[normalizeKey(key)];
    if (mapped) headerMap[key] = mapped;
  }
  return headerMap;
}

function getField(row: any, headerMap: Record<string, string>, field: string) {
  const originalKey = Object.keys(headerMap).find(k => headerMap[k] === field);
  return originalKey ? row[originalKey] : undefined;
}

// ── Grouping for ACESSORIOS ──

function groupRowsIntoProducts(
  json: any[],
  headerMap: Record<string, string>,
  codeMap: Map<string, string>,
): ParsedProductGroup[] {
  const groups = new Map<string, { rows: any[] }>();

  for (const row of json) {
    const code = String(getField(row, headerMap, 'code') || '').trim();
    if (!code) continue;
    if (!groups.has(code)) groups.set(code, { rows: [] });
    groups.get(code)!.rows.push(row);
  }

  return Array.from(groups.entries()).map(([code, { rows }]) => {
    const first = rows[0];
    const name = String(getField(first, headerMap, 'name') || '').trim();
    const description = String(getField(first, headerMap, 'description') || '').trim();
    const category = String(getField(first, headerMap, 'category') || '').trim();
    const basePrice = parsePrice(getField(first, headerMap, 'price'));
    const active = parseActive(getField(first, headerMap, 'active'));

    const variants: VariantRow[] = rows.map(r => ({
      color: String(getField(r, headerMap, 'color') || '').trim(),
      size: String(getField(r, headerMap, 'size') || '').trim(),
      price: parsePrice(getField(r, headerMap, 'price')),
      stock: parseStock(getField(r, headerMap, 'stock')),
      sku: String(getField(r, headerMap, 'sku') || '').trim(),
    }));

    const hasVariants = rows.length > 1 || variants.some(v => v.color || v.size);
    const existingId = codeMap.get(code.toLowerCase().trim());

    const valid = !!name && basePrice > 0 && !!code;
    const error = !code ? 'Código obrigatório' : !name ? 'Nome obrigatório' : basePrice <= 0 ? 'Preço inválido' : undefined;

    return {
      code,
      name,
      description,
      category,
      basePrice,
      active,
      hasVariants,
      variants,
      action: existingId ? 'update' as const : 'insert' as const,
      existingId,
      valid,
      error,
    };
  });
}

// ── Simple rows for non-ACESSORIOS ──

function parseSimpleRows(
  json: any[],
  headerMap: Record<string, string>,
  codeMap: Map<string, string>,
): ParsedRow[] {
  return json.map(row => {
    const code = String(getField(row, headerMap, 'code') || '').trim();
    const name = String(getField(row, headerMap, 'name') || '').trim();
    const price = parsePrice(getField(row, headerMap, 'price'));
    const price1Raw = parsePrice(getField(row, headerMap, 'price1'));
    const price9Raw = parsePrice(getField(row, headerMap, 'price9'));
    const price1 = price1Raw > 0 ? price1Raw : price;
    const price9 = price9Raw > 0 ? price9Raw : price;
    const valid = !!name && price > 0;
    const existingId = code ? codeMap.get(code.toLowerCase().trim()) : undefined;

    return {
      code,
      name,
      description: String(getField(row, headerMap, 'description') || '').trim(),
      category: String(getField(row, headerMap, 'category') || '').trim(),
      price,
      price1,
      price9,
      active: parseActive(getField(row, headerMap, 'active')),
      valid,
      error: !name ? 'Nome obrigatório' : price <= 0 ? 'Preço inválido' : undefined,
      action: existingId ? 'update' as const : 'insert' as const,
      existingId,
    };
  });
}

// ── Badge component ──

function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode; variant?: 'default' | 'destructive' | 'success'; className?: string }) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  const colors = variant === 'destructive'
    ? 'bg-destructive/20 text-destructive'
    : variant === 'success'
    ? 'bg-accent/20 text-accent'
    : 'bg-primary/20 text-primary';
  return <span className={`${base} ${colors} ${className}`}>{children}</span>;
}

// ── Template download ──

function downloadTemplate(isAccessories: boolean) {
  const data = isAccessories
    ? [
        { Codigo: '001', Nome: 'Camiseta Basic', Descricao: 'Algodao 100%', Categoria: 'Camisetas', Preco: 59.90, Cor: 'Azul', Tamanho: 'P', Estoque: 10, SKU: '001-AZ-P', Ativo: 'Sim' },
        { Codigo: '001', Nome: 'Camiseta Basic', Descricao: 'Algodao 100%', Categoria: 'Camisetas', Preco: 59.90, Cor: 'Azul', Tamanho: 'M', Estoque: 15, SKU: '001-AZ-M', Ativo: 'Sim' },
        { Codigo: '001', Nome: 'Camiseta Basic', Descricao: 'Algodao 100%', Categoria: 'Camisetas', Preco: 64.90, Cor: 'Preto', Tamanho: 'P', Estoque: 12, SKU: '001-PR-P', Ativo: 'Sim' },
        { Codigo: '002', Nome: 'Bone Trucker', Descricao: 'Aba curva', Categoria: 'Bones', Preco: 49.90, Cor: '', Tamanho: '', Estoque: 30, SKU: '002', Ativo: 'Sim' },
      ]
    : [
        { Codigo: '001', Nome: 'X-Burguer', Descricao: 'Hamburguer com queijo', Categoria: 'Lanches', Preco: 25.90, Preco1: 22.90, Preco9: 20.90, Ativo: 'Sim' },
        { Codigo: '002', Nome: 'Coca-Cola 350ml', Descricao: 'Refrigerante', Categoria: 'Bebidas', Preco: 7.50, Preco1: 6.50, Preco9: 5.90, Ativo: 'Sim' },
      ];

  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0]).map(k => ({ wch: Math.max(k.length, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
  XLSX.writeFile(wb, 'modelo_importacao_produtos.xlsx');
}

// ── Main component ──

export default function ImportProductsDialog({ open, onOpenChange, storeId, categories, storeType }: ImportProductsDialogProps) {
  const qc = useQueryClient();
  const isAccessories = storeType === 'ACESSORIOS';

  // Simple mode state
  const [rows, setRows] = useState<ParsedRow[]>([]);
  // Accessories mode state
  const [groups, setGroups] = useState<ParsedProductGroup[]>([]);

  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ updated: number; inserted: number; errors: number } | null>(null);

  const hasData = isAccessories ? groups.length > 0 : rows.length > 0;

  const reset = useCallback(() => {
    setRows([]);
    setGroups([]);
    setImporting(false);
    setProgress(0);
    setResult(null);
  }, []);

  // ── File parsing ──

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    reset();

    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, code')
      .eq('store_id', storeId)
      .neq('code', '');

    const codeMap = new Map<string, string>();
    for (const p of existingProducts || []) {
      if (p.code) codeMap.set(p.code.toLowerCase().trim(), p.id);
    }

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

        const headerMap = buildHeaderMap(Object.keys(json[0]));

        if (isAccessories) {
          setGroups(groupRowsIntoProducts(json, headerMap, codeMap));
        } else {
          setRows(parseSimpleRows(json, headerMap, codeMap));
        }
      } catch {
        toast.error('Erro ao ler o arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }, [reset, storeId, isAccessories]);

  // ── Import: ACESSORIOS mode ──

  const handleImportAccessories = useCallback(async () => {
    const validGroups = groups.filter(g => g.valid);
    if (!validGroups.length) return;

    setImporting(true);
    setProgress(0);

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
    let updated = 0, inserted = 0, errors = 0;
    const total = validGroups.length;

    for (let i = 0; i < validGroups.length; i++) {
      const g = validGroups[i];
      const categoryId = categoryMap.get(g.category.toLowerCase().trim()) || null;

      if (g.action === 'update' && g.existingId) {
        // Update product
        const { error } = await supabase.from('products').update({
          name: g.name,
          description: g.description,
          category_id: categoryId,
          base_price: g.basePrice,
          is_active: g.active,
          has_variants: g.hasVariants,
        }).eq('id', g.existingId);

        if (error) { errors++; }
        else {
          // Sync variants: delete old, insert new
          if (g.hasVariants) {
            await supabase.from('product_variants').delete().eq('product_id', g.existingId);
            const variantRecords = g.variants.map(v => ({
              product_id: g.existingId!,
              color: v.color || null,
              size: v.size || null,
              price: v.price,
              stock: v.stock,
              sku: v.sku,
            }));
            await supabase.from('product_variants').insert(variantRecords);
          }
          updated++;
        }
      } else {
        // Insert product
        const { data: newProduct, error } = await supabase.from('products').insert({
          store_id: storeId,
          code: g.code,
          name: g.name,
          description: g.description,
          category_id: categoryId,
          base_price: g.basePrice,
          is_active: g.active,
          has_variants: g.hasVariants,
        }).select('id').single();

        if (error || !newProduct) { errors++; }
        else {
          if (g.hasVariants) {
            const variantRecords = g.variants.map(v => ({
              product_id: newProduct.id,
              color: v.color || null,
              size: v.size || null,
              price: v.price,
              stock: v.stock,
              sku: v.sku,
            }));
            await supabase.from('product_variants').insert(variantRecords);
          }
          inserted++;
        }
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setResult({ updated, inserted, errors });
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['products'] });

    if (updated > 0) toast.success(`${updated} produto(s) atualizado(s)!`);
    if (inserted > 0) toast.success(`${inserted} produto(s) novo(s) importado(s)!`);
    if (errors > 0) toast.error(`${errors} produto(s) com erro.`);
  }, [groups, categories, storeId, qc]);

  // ── Import: Simple mode ──

  const handleImportSimple = useCallback(async () => {
    const validRows = rows.filter(r => r.valid);
    if (!validRows.length) return;

    setImporting(true);
    setProgress(0);

    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase().trim(), c.id]));
    let updated = 0, inserted = 0, errors = 0;

    const updates = validRows.filter(r => r.action === 'update' && r.existingId);
    const inserts = validRows.filter(r => r.action === 'insert');
    const total = validRows.length;
    let processed = 0;

    for (const r of updates) {
      const { error } = await supabase.from('products').update({
        name: r.name,
        description: r.description,
        category_id: categoryMap.get(r.category.toLowerCase().trim()) || null,
        base_price: r.price,
        price_table_1: r.price1,
        price_table_4: r.price,
        price_table_9: r.price9,
        is_active: r.active,
      }).eq('id', r.existingId!);

      if (error) errors++; else updated++;
      processed++;
      setProgress(Math.round((processed / total) * 100));
    }

    const BATCH = 50;
    for (let i = 0; i < inserts.length; i += BATCH) {
      const batch = inserts.slice(i, i + BATCH);
      const records = batch.map(r => ({
        store_id: storeId,
        code: r.code,
        name: r.name,
        description: r.description,
        category_id: categoryMap.get(r.category.toLowerCase().trim()) || null,
        base_price: r.price,
        price_table_1: r.price1,
        price_table_4: r.price,
        price_table_9: r.price9,
        is_active: r.active,
        has_variants: false,
      }));

      const { error } = await supabase.from('products').insert(records);
      if (error) errors += batch.length; else inserted += batch.length;
      processed += batch.length;
      setProgress(Math.round((processed / total) * 100));
    }

    setResult({ updated, inserted, errors });
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['products'] });

    if (updated > 0) toast.success(`${updated} produto(s) atualizado(s)!`);
    if (inserted > 0) toast.success(`${inserted} produto(s) novo(s) importado(s)!`);
    if (errors > 0) toast.error(`${errors} produto(s) com erro.`);
  }, [rows, categories, storeId, qc]);

  const handleImport = isAccessories ? handleImportAccessories : handleImportSimple;

  // ── Stats ──

  const stats = isAccessories
    ? {
        total: groups.length,
        valid: groups.filter(g => g.valid).length,
        invalid: groups.filter(g => !g.valid).length,
        update: groups.filter(g => g.valid && g.action === 'update').length,
        insert: groups.filter(g => g.valid && g.action === 'insert').length,
        variantCount: groups.reduce((s, g) => s + g.variants.length, 0),
      }
    : {
        total: rows.length,
        valid: rows.filter(r => r.valid).length,
        invalid: rows.filter(r => !r.valid).length,
        update: rows.filter(r => r.valid && r.action === 'update').length,
        insert: rows.filter(r => r.valid && r.action === 'insert').length,
        variantCount: 0,
      };

  // ── Render ──

  const description = isAccessories
    ? 'Colunas: Código, Nome, Descrição, Categoria, Preço, Cor, Tamanho, Estoque, SKU, Ativo. Linhas com o mesmo Código serão agrupadas como variantes.'
    : 'Selecione um arquivo .xlsx ou .xls com as colunas: Código, Nome, Descrição, Categoria, Preço (tabela 4 - varejo), Preco1 (atacado), Preco9 (atacado), Ativo. Preco1 e Preco9 são opcionais — se vazios, usam o valor de Preço. Produtos com código existente serão atualizados automaticamente.';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importar Produtos via Excel
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {result ? (
          <>
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-12 w-12 text-accent" />
              <p className="text-lg font-semibold">Importação concluída!</p>
              <p className="text-muted-foreground">
                {result.updated} atualizado(s) · {result.inserted} novo(s) · {result.errors} erro(s)
              </p>
            </div>
            <DialogFooter className="flex justify-between items-center">
              <Button variant="ghost" className="gap-1" onClick={() => downloadTemplate(isAccessories)}>
                <Download className="h-4 w-4" /> Baixar Modelo
              </Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {!hasData && (
              <div className="flex flex-col items-center gap-4 py-8 border-2 border-dashed rounded-lg">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">Selecione o arquivo Excel</p>
                <label>
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />
                  <Button asChild variant="outline"><span>Escolher Arquivo</span></Button>
                </label>
              </div>
            )}

            {hasData && (
              <>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="text-muted-foreground">
                    {stats.total} produto(s){isAccessories && stats.variantCount > 0 ? ` · ${stats.variantCount} variante(s)` : ''}
                  </span>
                  {stats.update > 0 && <Badge variant="default"><RefreshCw className="h-3 w-3 mr-1" />{stats.update} atualizar</Badge>}
                  {stats.insert > 0 && <Badge variant="success"><Plus className="h-3 w-3 mr-1" />{stats.insert} novo(s)</Badge>}
                  {stats.invalid > 0 && <Badge variant="destructive">{stats.invalid} inválida(s)</Badge>}
                </div>

                <div className="flex-1 overflow-auto border rounded-lg">
                  {isAccessories ? (
                    <AccessoriesPreviewTable groups={groups} />
                  ) : (
                    <SimplePreviewTable rows={rows} />
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

            <DialogFooter className="flex justify-between items-center">
              <Button variant="ghost" className="gap-1" onClick={() => downloadTemplate(isAccessories)}>
                <Download className="h-4 w-4" /> Baixar Modelo
              </Button>
              {hasData && !importing && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset}>Trocar Arquivo</Button>
                  <Button onClick={handleImport} disabled={stats.valid === 0} className="gap-2">
                    <Upload className="h-4 w-4" />
                    Importar {stats.valid} produto(s)
                  </Button>
                </div>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Preview tables ──

function SimplePreviewTable({ rows }: { rows: ParsedRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">Ação</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Preço (T4)</TableHead>
          <TableHead>T1</TableHead>
          <TableHead>T9</TableHead>
          <TableHead>Ativo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.slice(0, 100).map((row, i) => (
          <TableRow key={i} className={row.valid ? '' : 'bg-destructive/10'}>
            <TableCell>
              {!row.valid ? <AlertCircle className="h-4 w-4 text-destructive" />
                : row.action === 'update' ? <RefreshCw className="h-4 w-4 text-primary" />
                : <Plus className="h-4 w-4 text-accent" />}
            </TableCell>
            <TableCell className="font-mono text-sm">{row.code || '-'}</TableCell>
            <TableCell>{row.name || <span className="text-destructive">Vazio</span>}</TableCell>
            <TableCell>{row.category || '-'}</TableCell>
            <TableCell>{row.price > 0 ? formatCurrency(row.price) : <span className="text-destructive">Inválido</span>}</TableCell>
            <TableCell>{formatCurrency(row.price1)}</TableCell>
            <TableCell>{formatCurrency(row.price9)}</TableCell>
            <TableCell>{row.active ? 'Sim' : 'Não'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      {rows.length > 100 && (
        <caption className="caption-bottom p-2 text-sm text-muted-foreground">
          Mostrando 100 de {rows.length} linhas
        </caption>
      )}
    </Table>
  );
}

function AccessoriesPreviewTable({ groups }: { groups: ParsedProductGroup[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">Ação</TableHead>
          <TableHead>Código</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Cor</TableHead>
          <TableHead>Tam.</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead>Estoque</TableHead>
          <TableHead>SKU</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.slice(0, 50).map((g, gi) => (
          <>
            {/* Product row */}
            <TableRow key={`p-${gi}`} className={g.valid ? 'bg-muted/30' : 'bg-destructive/10'}>
              <TableCell>
                {!g.valid ? <AlertCircle className="h-4 w-4 text-destructive" />
                  : g.action === 'update' ? <RefreshCw className="h-4 w-4 text-primary" />
                  : <Plus className="h-4 w-4 text-accent" />}
              </TableCell>
              <TableCell className="font-mono text-sm font-bold">{g.code}</TableCell>
              <TableCell className="font-semibold">{g.name || <span className="text-destructive">Vazio</span>}</TableCell>
              <TableCell>{g.category || '-'}</TableCell>
              <TableCell colSpan={3} className="text-muted-foreground text-xs">
                {g.hasVariants ? `${g.variants.length} variante(s)` : formatCurrency(g.basePrice)}
              </TableCell>
              <TableCell />
              <TableCell />
            </TableRow>
            {/* Variant rows */}
            {g.hasVariants && g.variants.map((v, vi) => (
              <TableRow key={`v-${gi}-${vi}`} className="text-sm">
                <TableCell />
                <TableCell />
                <TableCell className="pl-8 text-muted-foreground">↳</TableCell>
                <TableCell />
                <TableCell>{v.color || '-'}</TableCell>
                <TableCell>{v.size || '-'}</TableCell>
                <TableCell>{formatCurrency(v.price)}</TableCell>
                <TableCell>{v.stock}</TableCell>
                <TableCell className="font-mono text-xs">{v.sku || '-'}</TableCell>
              </TableRow>
            ))}
          </>
        ))}
      </TableBody>
      {groups.length > 50 && (
        <caption className="caption-bottom p-2 text-sm text-muted-foreground">
          Mostrando 50 de {groups.length} produtos
        </caption>
      )}
    </Table>
  );
}
