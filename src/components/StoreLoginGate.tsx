import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock, Clock, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import { Button } from '@/components/ui/button';
import CustomerAuthDialog, { ApprovalNotice } from '@/components/CustomerAuthDialog';
import type { Store } from '@/types';

/** Quando a loja exige login, só libera o catálogo para cliente aprovado, equipe ou admin. */
export function storeRequiresLogin(store?: Store | null) {
  return (store?.settings as any)?.requireLoginToBrowse === true;
}

export default function StoreLoginGate({ store, children }: { store: Store; children: ReactNode }) {
  const required = storeRequiresLogin(store);
  const { user, loading: authLoading, signOut } = useAuth();
  const { hasAccess, isStoreUser, loading: staffLoading } = useStoreAdmin(required ? store.id : undefined);
  const [open, setOpen] = useState(false);
  const allowSignup = store.settings?.allowCustomerSignup !== false;
  const supportWhatsapp = String((store.settings as any)?.approvalSupportWhatsapp || '');

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['gate-profile', user?.id, store.id],
    queryFn: async () => {
      const { data } = await supabase.from('customer_profiles')
        .select('is_active, approval_status').eq('user_id', user!.id).eq('store_id', store.id).maybeSingle();
      return data as { is_active: boolean; approval_status: string } | null;
    },
    enabled: required && !!user,
    refetchInterval: 60_000,
  });

  if (!required) return <>{children}</>;
  if (authLoading || (user && (staffLoading || profileLoading))) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  if (user && (hasAccess || isStoreUser)) return <>{children}</>;
  if (user && profile && profile.is_active && profile.approval_status !== 'pending') return <>{children}</>;

  const pending = !!user && !!profile && (profile.approval_status === 'pending' || !profile.is_active);
  const needsProfile = !!user && !profile;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        {store.logo && <img src={store.logo} alt={store.name} className="mx-auto mb-4 h-20 object-contain" />}
        <h1 className="text-xl font-bold">{store.name}</h1>
        {pending ? (
          <>
            <Clock className="mx-auto my-4 h-10 w-10 text-primary" />
            <ApprovalNotice kind="pending" supportWhatsapp={supportWhatsapp} />
            <Button variant="outline" className="mt-6 w-full" onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </>
        ) : (
          <>
            <Lock className="mx-auto my-4 h-10 w-10 text-primary" />
            <p className="text-sm text-muted-foreground">
              {needsProfile ? 'Complete seu cadastro para enviar à aprovação.' : 'Acesso exclusivo para clientes. Faça login ou cadastre-se para solicitar acesso.'}
            </p>
            <Button className="mt-6 w-full" onClick={() => setOpen(true)}>
              {needsProfile ? 'Completar cadastro' : allowSignup ? 'Fazer login ou Cadastre-se' : 'Fazer login'}
            </Button>
            {needsProfile && <Button variant="ghost" className="mt-2 w-full" onClick={() => signOut()}>Sair</Button>}
          </>
        )}
      </div>
      <CustomerAuthDialog open={open} onOpenChange={setOpen} storeId={store.id} storeSlug={store.slug}
        allowSignup={allowSignup} requireApproval startAtProfile={needsProfile} supportWhatsapp={supportWhatsapp} />
    </div>
  );
}
