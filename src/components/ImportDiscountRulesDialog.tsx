import { useState, useCallback } from 'react';
import * as XLSX from '@e965/xlsx';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { DiscountRule } from '@/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRules: DiscountRule[]; // current group-type rules
  onImport: (rules: DiscountRule[]) => Promise<void> | void;
}

interface ParsedRule {
  groupId: string;
  minQuantity: number;
  discountPercent: number;
  isNew: boolean;
}

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function extractGroupName(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Strip leading "NN - " prefix if present
  const m = s.match(/^\s*\d+\s*-\s*(.+)$/);
  return (m ? m[1] : s).trim();
}

export default function ImportDiscountRulesDialog({ open, onOpenChange, existingRules, onImport }: Props) {
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [parsed, setParsed] = useState<ParsedRule[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setParsed(null);
    setSkipped(0);
    setFileName('');
  };

  const handleFile = useCallback(async (file: File) => {
    setParsing(true);
    reset();
    try {
      setFileName(file.name);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (rows.length < 2) {
        toast.error('Planilha vazia');
        setParsing(false);
        return;
      }

      // Find header row (look for "grupo" + "qtde" or "qtd" + "percent")
      let headerIdx = -1;
      let gIdx = -1, qIdx = -1, pIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cells = rows[i].map(c => normalize(String(c)));
        const g = cells.findIndex(c => c.includes('grupo'));
        const q = cells.findIndex(c => c.includes('qtde') || c.includes('qtd') || c.includes('quantidade') || c.includes('inicial'));
        const p = cells.findIndex(c => c.includes('percent') || c.includes('desconto') || c === '%');
        if (g !== -1 && q !== -1 && p !== -1) {
          headerIdx = i; gIdx = g; qIdx = q; pIdx = p;
          break;
        }
      }
      if (headerIdx === -1) {
        toast.error('Colunas não encontradas. Esperado: Grupo do Produto, Qtde. Inicial, Percentual.');
        setParsing(false);
        return;
      }

      const existingNames = new Set(
        existingRules.map(r => normalize(r.groupId || ''))
      );

      const out: ParsedRule[] = [];
      let ignored = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const rawGroup = String(row[gIdx] || '').trim();
        const qty = Number(String(row[qIdx]).replace(',', '.'));
        const pct = Number(String(row[pIdx]).replace(',', '.'));
        if (!rawGroup || normalize(rawGroup) === 'todos' || !qty || qty <= 0 || !pct || pct <= 0) {
          ignored++;
          continue;
        }
        const groupName = extractGroupName(rawGroup);
        if (!groupName) { ignored++; continue; }
        out.push({
          groupId: groupName,
          minQuantity: Math.round(qty),
          discountPercent: Number(pct.toFixed(2)),
          isNew: !existingNames.has(normalize(groupName)),
        });
      }

      // Sort
      out.sort((a, b) => a.groupId.localeCompare(b.groupId) || a.minQuantity - b.minQuantity);
      setParsed(out);
      setSkipped(ignored);
      if (out.length === 0) toast.error('Nenhuma regra válida encontrada');
      else toast.success(`${out.length} regras lidas`);
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao ler planilha: ' + (e?.message || e));
    }
    setParsing(false);
  }, [existingRules]);

  const handleConfirm = async () => {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    try {
      const rules: DiscountRule[] = parsed.map(p => ({
        id: crypto.randomUUID(),
        type: 'group',
        groupId: p.groupId,
        minQuantity: p.minQuantity,
        discountPercent: p.discountPercent,
        description: `${p.discountPercent}% off`,
      }));
      await onImport(rules);
      toast.success('Regras importadas e salvas!');
      onOpenChange(false);
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao salvar: ' + (e?.message || e));
    }
    setImporting(false);
  };

  const newCount = parsed?.filter(p => p.isNew).length ?? 0;
  const updateCount = (parsed?.length ?? 0) - newCount;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Regras de Desconto
          </DialogTitle>
          <DialogDescription>
            Planilha com colunas: <b>Grupo do Produto</b>, <b>Qtde. Inicial</b>, <b>Percentual</b>.
            Linhas com grupo "Todos" ou valores zero são ignoradas. As regras de tipo "grupo" serão substituídas pelas importadas.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <input
              id="discount-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={parsing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <label htmlFor="discount-file">
              <Button asChild disabled={parsing} className="gap-2 cursor-pointer">
                <span>
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {parsing ? 'Lendo...' : 'Selecionar planilha (.xlsx)'}
                </span>
              </Button>
            </label>
          </div>
        )}

        {parsed && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="gap-1"><FileSpreadsheet className="h-3 w-3" />{fileName}</Badge>
              <Badge className="gap-1 bg-emerald-600"><CheckCircle className="h-3 w-3" />{updateCount} atualizar</Badge>
              <Badge className="gap-1 bg-blue-600"><CheckCircle className="h-3 w-3" />{newCount} novos</Badge>
              {skipped > 0 && (
                <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />{skipped} ignoradas</Badge>
              )}
            </div>
            <div className="flex-1 overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Qtd. Mínima</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline" className="font-mono">{r.groupId}</Badge></TableCell>
                      <TableCell>{r.minQuantity}+ peças</TableCell>
                      <TableCell><Badge className="bg-accent text-accent-foreground">{r.discountPercent}% OFF</Badge></TableCell>
                      <TableCell>
                        {r.isNew
                          ? <Badge className="bg-blue-600">Novo</Badge>
                          : <Badge variant="outline">Atualizar</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {parsed && (
            <Button variant="outline" onClick={reset} disabled={importing}>
              Trocar planilha
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!parsed || parsed.length === 0 || importing}
            className="gap-2"
          >
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar Importação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
