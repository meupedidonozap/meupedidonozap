import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useStoreBySlug } from '@/hooks/useStores';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import InvoicesPanel from '@/components/InvoicesPanel';

export default function CustomerInvoicesPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: store, isLoading: storeLoading } = useStoreBySlug(slug || '');
  const { user, loading: authLoading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['my-invoice-customer-code', user?.id, store?.id],
    enabled: !!user?.id && !!store?.id,
    queryFn: async () => {
      const { data } = await supabase.from('customer_profiles').select('customer_code')
        .eq('user_id', user?.id || '').eq('store_id', store?.id || '').maybeSingle();
      return data;
    },
  });

  const loader = <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (storeLoading || authLoading) return loader;
  if (!store) return <div className="p-10 text-center">Loja não encontrada</div>;
  const code = profile?.customer_code?.trim();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="container flex h-14 items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to={`/${store.slug}`}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <h1 className="font-bold">Minhas Notas Fiscais</h1>
        </div>
      </header>
      <main className="container py-6">
        {!user ? (
          <div className="py-16 text-center"><h2 className="text-xl font-bold">Faça login para ver suas notas fiscais</h2><Button asChild className="mt-4"><Link to={`/${store.slug}`}>Voltar à loja</Link></Button></div>
        ) : profileLoading ? loader : !code ? (
          <div className="py-16 text-center text-muted-foreground"><FileText className="mx-auto h-12 w-12 opacity-30" /><p className="mt-4">Seu cadastro ainda não possui código de cliente. Fale com seu representante.</p></div>
        ) : (
          <InvoicesPanel storeId={store.id} customerCode={code} startDate={store.settings.titlesStartDate} />
        )}
      </main>
    </div>
  );
}