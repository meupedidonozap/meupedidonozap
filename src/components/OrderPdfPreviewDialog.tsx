import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, Download, Share2, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { subscribeOrderPdf, previewOrderPdf } from '@/lib/orderPdfPreview';
import { deliverOrderPdfFile } from '@/lib/shareOrderPdf';

export default function OrderPdfPreviewDialog() {
  const [file, setFile] = useState<File | null>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(560);
  const [zoom, setZoom] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => subscribeOrderPdf(setFile), []);

  useEffect(() => {
    setDocument(null);
    setPageNumber(1);
    setZoom(0);
    setError('');
    if (!file) return;
    let active = true;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    setLoading(true);
    async function load() {
      try {
        const [pdfjs, worker, bytes] = await Promise.all([
          import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
          file?.arrayBuffer(),
        ]);
        if (!active || !bytes) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        task = pdfjs.getDocument({ data: bytes });
        const pdf = await task.promise;
        if (active) setDocument(pdf);
      } catch {
        if (active) { setError('Não foi possível visualizar o PDF.'); setLoading(false); }
      }
    }
    void load();
    return () => { active = false; void task?.destroy(); };
  }, [file]);

  useEffect(() => {
    if (!file) return;
    const node = container.current;
    if (!node) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(200, entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [file, document]);

  useEffect(() => {
    const target = canvas.current;
    if (!document || !target) return;
    let active = true;
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined;
    setLoading(true);
    async function render() {
      try {
        if (!document || !target) return;
        const page = await document.getPage(pageNumber);
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        const scale = width * (1 + zoom * 0.5) / base.width;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: scale * ratio });
        target.width = Math.ceil(viewport.width);
        target.height = Math.ceil(viewport.height);
        task = page.render({ canvas: target, viewport });
        await task.promise;
        if (active) setLoading(false);
      } catch {
        if (active) { setError('Não foi possível visualizar esta página.'); setLoading(false); }
      }
    }
    void render();
    return () => { active = false; task?.cancel(); };
  }, [document, pageNumber, width, zoom]);

  async function deliver(mode: 'download' | 'share') {
    if (!file || busy) return;
    setBusy(true);
    try { await deliverOrderPdfFile(file, mode, true); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível entregar o PDF.'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={!!file} onOpenChange={open => { if (!open && !busy) previewOrderPdf(null); }}>
      <DialogContent className="flex h-[90dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-3 p-4">
        <DialogHeader className="min-w-0 pr-7 text-left">
          <DialogTitle>PDF</DialogTitle>
          <DialogDescription className="break-all">{file?.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" title="Página anterior" aria-label="Página anterior" disabled={pageNumber <= 1 || loading} onClick={() => setPageNumber(n => n - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-16 text-center text-sm">{pageNumber} / {document?.numPages || '—'}</span>
            <Button variant="outline" size="icon" title="Próxima página" aria-label="Próxima página" disabled={!document || pageNumber >= document.numPages || loading} onClick={() => setPageNumber(n => n + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void deliver('share')} title="Compartilhar PDF"><Share2 className="mr-1 h-4 w-4" /><span>Enviar</span></Button>
            <Button size="sm" disabled={busy} onClick={() => void deliver('download')}><Download className="mr-1 h-4 w-4" />Baixar PDF</Button>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button size="icon" variant="ghost" title="Reduzir zoom" aria-label="Reduzir zoom" disabled={zoom === 0 || loading} onClick={() => setZoom(z => z - 1)}><ZoomOut className="h-4 w-4" /></Button>
          <span className="min-w-12 text-center text-xs text-muted-foreground">{100 + zoom * 50}%</span>
          <Button size="icon" variant="ghost" title="Aumentar zoom" aria-label="Aumentar zoom" disabled={zoom === 4 || loading} onClick={() => setZoom(z => z + 1)}><ZoomIn className="h-4 w-4" /></Button>
        </div>
        <div ref={container} className="relative min-h-0 flex-1 overflow-auto bg-muted p-3">
          {loading && <Loader2 aria-label="Carregando PDF" className="absolute left-1/2 top-8 h-6 w-6 animate-spin text-primary" />}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <div className={['w-full', 'w-[150%]', 'w-[200%]', 'w-[250%]', 'w-[300%]'][zoom]}><canvas ref={canvas} aria-label={`Página ${pageNumber} do PDF`} className="mx-auto h-auto w-full" /></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}