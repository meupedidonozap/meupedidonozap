import { useState } from 'react';
import { Plus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateStore } from '@/hooks/useStores';
import {
  useTechnicalMaterials, useSaveTechnicalMaterial, useDeleteTechnicalMaterial, materialLabel,
  type TechnicalMaterial, type MaterialMedia, type MaterialMediaType,
} from '@/hooks/useTechnicalMaterials';

interface Props { store: any; products: any[] }

const empty = (storeId: string): Partial<TechnicalMaterial> & { storeId: string; title: string } =>
  ({ storeId, title: '', body: '', media: [], productIds: [], isActive: true, sortOrder: 0 });

const typeLabel: Record<MaterialMediaType, string> = { video: 'Vídeo (YouTube/Instagram)', pdf: 'PDF', image: 'Foto', link: 'Link' };

export default function TechnicalMaterialsAdminTab({ store, products }: Props) {
  const { data: materials = [] } = useTechnicalMaterials(store.id);
  const save = useSaveTechnicalMaterial();
  const del = useDeleteTechnicalMaterial();
  const updateStore = useUpdateStore();
  const [label, setLabel] = useState(materialLabel(store.settings));
  const [editing, setEditing] = useState<ReturnType<typeof empty> | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const saveLabel = async () => {
    try {
      await updateStore.mutateAsync({ id: store.id, settings: { ...store.settings, technicalMaterialLabel: label.trim() } });
      toast.success('Nome do menu salvo');
    } catch (e: any) { toast.error(e.message); }
  };

  const setMedia = (media: MaterialMedia[]) => setEditing(e => e && { ...e, media });

  const uploadFile = async (file: File, type: MaterialMediaType) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${store.id}/materiais/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: true });
      if (error) throw error;
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      setMedia([...(editing?.media || []), { type, url, label: file.name.replace(/\.[^.]+$/, '') }]);
    } catch (e: any) { toast.error('Falha no envio: ' + e.message); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!editing?.title.trim()) return toast.error('Informe o título');
    try {
      await save.mutateAsync({ ...editing, media: (editing.media || []).filter(m => m.url.trim()) });
      toast.success('Conteúdo salvo');
      setEditing(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const filteredProducts = products
    .filter(p => !productSearch || `${p.code} ${p.name}`.toLowerCase().includes(productSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  const productName = (id: string) => products.find(p => p.id === id)?.name || '—';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Nome do menu</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Material Técnico" />
          <Button onClick={saveLabel} disabled={updateStore.isPending}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Conteúdos ({materials.length})</CardTitle>
          <Button onClick={() => setEditing(empty(store.id))} className="gap-2"><Plus className="h-4 w-4" /> Novo conteúdo</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {materials.length === 0 && <p className="text-sm text-muted-foreground">Nenhum conteúdo cadastrado.</p>}
          {materials.map(m => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <p className="font-medium">{m.title} {!m.isActive && <Badge variant="secondary">Inativo</Badge>}</p>
                <p className="text-xs text-muted-foreground">{m.media.length} anexo(s) · {m.productIds.length} produto(s)</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing({ ...m })} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Excluir" onClick={() => confirm(`Excluir "${m.title}"?`) && del.mutate(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar conteúdo' : 'Novo conteúdo'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label>Título</Label><Input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} /></div>
              <div><Label>Texto</Label><Textarea rows={5} value={editing.body} onChange={e => setEditing({ ...editing, body: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={editing.isActive} onCheckedChange={v => setEditing({ ...editing, isActive: v })} /><Label>Ativo</Label></div>

              <div className="space-y-2">
                <Label>Anexos (vídeos, PDFs, fotos, links)</Label>
                {(editing.media || []).map((m, i) => (
                  <div key={i} className="flex flex-wrap gap-2 rounded-md border p-2">
                    <Select value={m.type} onValueChange={(v: MaterialMediaType) => setMedia(editing.media!.map((x, j) => j === i ? { ...x, type: v } : x))}>
                      <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(typeLabel) as MaterialMediaType[]).map(t => <SelectItem key={t} value={t}>{typeLabel[t]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="flex-1 min-w-40" placeholder="Endereço (link)" value={m.url} onChange={e => setMedia(editing.media!.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} />
                    <Input className="flex-1 min-w-32" placeholder="Legenda (opcional)" value={m.label || ''} onChange={e => setMedia(editing.media!.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
                    <Button size="icon" variant="ghost" onClick={() => setMedia(editing.media!.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setMedia([...(editing.media || []), { type: 'video', url: '' }])}><Plus className="mr-1 h-4 w-4" /> Link de vídeo</Button>
                  <Button variant="outline" size="sm" onClick={() => setMedia([...(editing.media || []), { type: 'link', url: '' }])}><Plus className="mr-1 h-4 w-4" /> Outro link</Button>
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer"><Upload className="mr-1 h-4 w-4" /> Enviar PDF
                      <input type="file" accept="application/pdf" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'pdf'); e.target.value = ''; }} /></label>
                  </Button>
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <label className="cursor-pointer"><Upload className="mr-1 h-4 w-4" /> Enviar foto
                      <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f, 'image'); e.target.value = ''; }} /></label>
                  </Button>
                  {uploading && <span className="text-sm text-muted-foreground">Enviando...</span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Produtos que mostram "Saiba mais" ({editing.productIds?.length || 0})</Label>
                {!!editing.productIds?.length && (
                  <div className="flex flex-wrap gap-1">
                    {editing.productIds.map(id => (
                      <Badge key={id} variant="secondary" className="gap-1">{productName(id)}
                        <button onClick={() => setEditing({ ...editing, productIds: editing.productIds!.filter(x => x !== id) })}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Input placeholder="Buscar produto por código ou nome..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
                <div className="max-h-56 overflow-y-auto rounded-md border">
                  {filteredProducts.slice(0, 200).map(p => {
                    const checked = editing.productIds?.includes(p.id);
                    return (
                      <label key={p.id} className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-0 hover:bg-muted">
                        <Checkbox checked={checked} onCheckedChange={v => setEditing({
                          ...editing, productIds: v ? [...(editing.productIds || []), p.id] : editing.productIds!.filter(x => x !== p.id),
                        })} />
                        <span className="font-mono text-xs text-muted-foreground">{p.code}</span> {p.name}
                      </label>
                    );
                  })}
                </div>
                {filteredProducts.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...editing, productIds: Array.from(new Set([...(editing.productIds || []), ...filteredProducts.map(p => p.id)])) })}>
                    Marcar todos os {filteredProducts.length} da busca
                  </Button>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={save.isPending || uploading}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
