import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useStoreBySlug } from '@/hooks/useStores';
import { useProducts } from '@/hooks/useProducts';
import { useTechnicalMaterials, materialLabel } from '@/hooks/useTechnicalMaterials';
import TechnicalMaterialView from '@/components/TechnicalMaterialView';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TechnicalMaterialsPage() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const productId = params.get('produto');
  const { data: store } = useStoreBySlug(slug || '');
  const { data: materials = [], isLoading } = useTechnicalMaterials(store?.id);
  const { data: products = [] } = useProducts(store?.id);
  const [q, setQ] = useState('');
  const label = materialLabel(store?.settings);
  const product = (products as any[]).find(p => p.id === productId);

  const list = useMemo(() => materials
    .filter(m => m.isActive)
    .filter(m => !productId || m.productIds.includes(productId))
    .filter(m => !q || (m.title + ' ' + m.body).toLowerCase().includes(q.toLowerCase())), [materials, productId, q]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card shadow-sm">
        <div className="container flex h-16 items-center gap-3">
          <Button variant="ghost" size="icon" asChild><Link to={`/${slug}`} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <h1 className="text-lg font-bold truncate">{label}</h1>
        </div>
      </header>
      <main className="container max-w-3xl space-y-4 py-6">
        {product && (
          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <span>Produto: <Badge variant="outline" className="font-mono">{product.code}</Badge> {product.name}</span>
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>Ver todos</Button>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar conteúdo..." value={q} onChange={e => setQ(e.target.value)} />
        </div>
        {isLoading ? <p className="text-muted-foreground">Carregando...</p> : list.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">Nenhum conteúdo encontrado.</p>
        ) : (
          <Accordion type="single" collapsible defaultValue={list.length === 1 ? list[0].id : undefined}>
            {list.map(m => (
              <AccordionItem key={m.id} value={m.id}>
                <AccordionTrigger className="text-left">{m.title}</AccordionTrigger>
                <AccordionContent><TechnicalMaterialView material={m} /></AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </main>
    </div>
  );
}
