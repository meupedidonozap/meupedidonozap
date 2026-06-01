import { useState, useCallback } from 'react';
import * as XLSX from '@e965/xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Upload, Download, Loader2, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  mode?: 'import' | 'update';
}

interface RowInput {
  codigo: string;
  nome: string;
  cpf_cnpj?: string;
  whatsapp?: string;
  cep?: string;
  uf?: string;
  cidade?: string;
  bairro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  codigo_vendedor?: string;
}

interface ResultRow {
  codigo: string;
  nome: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  email?: string;
  senha?: string;
  erro?: string;
}

const COLUMNS = ['codigo','nome','cpf_cnpj','whatsapp','cep','uf','cidade','bairro','endereco','numero','complemento','codigo_vendedor'];

export default function ImportCustomersDialog({ open, onOpenChange, storeId, mode = 'import' }: Props) {
  const isUpdate = mode === 'update';
  const qc = useQueryClient();
  const [rows, setRows] = useState<RowInput[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResults(null);
    setImporting(false);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      COLUMNS,
      ['96133', 'CLIENTE EXEMPLO LTDA', '12.345.678/0001-90', '47999998888', '88301-000', 'SC', 'Itajaí', 'Centro', 'Rua das Flores', '123', 'Sala 4', 'V01'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, 'modelo_clientes.xlsx');
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    const parsed: RowInput[] = json.map((r) => ({
      codigo: String(r.codigo ?? r.Codigo ?? r.CODIGO ?? '').trim(),
      nome: String(r.nome ?? r.Nome ?? r.NOME ?? '').trim(),
      cpf_cnpj: String(r.cpf_cnpj ?? r['CPF/CNPJ'] ?? r.cpf ?? r.cnpj ?? '').trim(),
      whatsapp: String(r.whatsapp ?? r.Whatsapp ?? r.WHATSAPP ?? r.telefone ?? '').trim(),
      cep: String(r.cep ?? r.CEP ?? '').trim(),
      uf: String(r.uf ?? r.UF ?? '').trim(),
      cidade: String(r.cidade ?? r.Cidade ?? r.CIDADE ?? '').trim(),
      bairro: String(r.bairro ?? r.Bairro ?? '').trim(),
      endereco: String(r.endereco ?? r['endereço'] ?? r.Endereco ?? '').trim(),
      numero: String(r.numero ?? r['número'] ?? r.Numero ?? '').trim(),
      complemento: String(r.complemento ?? r.Complemento ?? '').trim(),
      codigo_vendedor: String(r.codigo_vendedor ?? r['código_vendedor'] ?? r.vendedor ?? '').trim(),
    })).filter(r => r.codigo || r.nome);
    setRows(parsed);
    setResults(null);
  };

  const validCount = rows.filter(r => r.codigo && r.nome).length;
  const invalidCount = rows.length - validCount;

  const runImport = async () => {
    if (!validCount) {
      toast.error('Nenhuma linha válida para importar');
      return;
    }
    setImporting(true);
    try {
      const BATCH = 25;
      const valid = rows.filter(r => r.codigo && r.nome);
      const all: ResultRow[] = [];
      for (let i = 0; i < valid.length; i += BATCH) {
        const slice = valid.slice(i, i + BATCH);
        const { data, error } = await supabase.functions.invoke('import-customers', {
          body: { storeId, rows: slice, mode },
        });
        if (error) throw error;
        all.push(...(data?.results || []));
      }
      setResults(all);
      qc.invalidateQueries({ queryKey: ['store-customer-profiles', storeId] });
      const created = all.filter(r => r.status === 'created').length;
      const updated = all.filter(r => r.status === 'updated').length;
      const skipped = all.filter(r => r.status === 'skipped').length;
      const errors = all.filter(r => r.status === 'error').length;
      toast.success(
        isUpdate
          ? `${created} novo(s), ${updated} atualizado(s), ${errors} erro(s)`
          : `${created} criado(s), ${updated} atualizado(s), ${errors} erro(s)`,
      );
    } catch (err: any) {
      toast.error('Erro na importação: ' + (err?.message || err));
    } finally {
      setImporting(false);
    }
  };

  const downloadCredentials = () => {
    if (!results) return;
    const ok = results.filter(r => r.status !== 'error');
    const ws = XLSX.utils.aoa_to_sheet([
      ['codigo', 'nome', 'login (codigo)', 'senha', 'status'],
      ...ok.map(r => [r.codigo, r.nome, r.codigo, r.senha || '', r.status]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credenciais');
    XLSX.writeFile(wb, 'credenciais_clientes.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isUpdate ? 'Atualizar Clientes do ERP' : 'Importar Clientes do ERP'}</DialogTitle>
          <DialogDescription>
            {isUpdate ? (
              <>
                Carregue uma planilha .xlsx com os clientes. O match é feito pelo <strong>código do cliente</strong> (com fallback por CPF/CNPJ).
                <br />
                Clientes já cadastrados terão dados atualizados. Clientes sem cadastro serão criados automaticamente.
              </>
            ) : (
              <>
                Carregue uma planilha .xlsx com os clientes. Cada linha cria (ou atualiza) o cadastro e o login do cliente.
                <br />
                <strong>Login = código do cliente</strong>. Senha = mesma do código (mín. 6 chars; códigos curtos recebem prefixo "dico").
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!results && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" /> Baixar modelo
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
                <Button variant="default" size="sm" asChild>
                  <span className="cursor-pointer"><Upload className="mr-2 h-4 w-4" /> Selecionar planilha</span>
                </Button>
              </label>
              {fileName && (
                <span className="inline-flex items-center text-sm text-muted-foreground gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> {fileName}
                </span>
              )}
            </div>

            {rows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm">
                  <span><strong>{rows.length}</strong> linhas</span>
                  <span className="text-green-700"><CheckCircle className="inline h-4 w-4 mr-1" />{validCount} válidas</span>
                  {invalidCount > 0 && <span className="text-red-700"><AlertCircle className="inline h-4 w-4 mr-1" />{invalidCount} inválidas</span>}
                </div>
                <div className="border rounded max-h-[40vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF/CNPJ</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Cidade/UF</TableHead>
                        <TableHead>Vendedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 50).map((r, i) => (
                        <TableRow key={i} className={!r.codigo || !r.nome ? 'bg-red-50' : ''}>
                          <TableCell className="font-mono">{r.codigo || '—'}</TableCell>
                          <TableCell>{r.nome || '—'}</TableCell>
                          <TableCell>{r.cpf_cnpj || '—'}</TableCell>
                          <TableCell>{r.whatsapp || '—'}</TableCell>
                          <TableCell>{r.cidade || '—'}{r.uf ? `/${r.uf}` : ''}</TableCell>
                          <TableCell>{r.codigo_vendedor || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 50 && <p className="p-2 text-xs text-muted-foreground">Mostrando 50 de {rows.length} linhas.</p>}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={runImport} disabled={importing || !validCount}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUpdate ? `Confirmar atualização (${validCount})` : `Confirmar importação (${validCount})`}
              </Button>
            </DialogFooter>
          </>
        )}

        {results && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-green-700"><CheckCircle className="inline h-4 w-4 mr-1" />Criados: <strong>{results.filter(r => r.status === 'created').length}</strong></span>
              <span className="text-blue-700"><RefreshCw className="inline h-4 w-4 mr-1" />Atualizados: <strong>{results.filter(r => r.status === 'updated').length}</strong></span>
              <span className="text-gray-700">Ignorados (já existiam): <strong>{results.filter(r => r.status === 'skipped').length}</strong></span>
              <span className="text-red-700"><AlertCircle className="inline h-4 w-4 mr-1" />Erros: <strong>{results.filter(r => r.status === 'error').length}</strong></span>
            </div>
            <Button onClick={downloadCredentials} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" /> Baixar planilha de credenciais (login + senha)
            </Button>
            <div className="border rounded max-h-[50vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Senha</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono">{r.codigo}</TableCell>
                      <TableCell>{r.nome}</TableCell>
                      <TableCell>
                        {r.status === 'created' && <span className="text-green-700">Criado</span>}
                        {r.status === 'updated' && <span className="text-blue-700">Atualizado</span>}
                        {r.status === 'skipped' && <span className="text-gray-600">Ignorado</span>}
                        {r.status === 'error' && <span className="text-red-700">Erro</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.senha || '—'}</TableCell>
                      <TableCell className="text-xs text-red-700">{r.erro || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Importar outra planilha</Button>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}