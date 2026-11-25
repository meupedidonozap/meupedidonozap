import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useIsFetching, useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DicoloreReportContext } from '@/contexts/DicoloreReportContext';
import { useStoreBySlug } from '@/hooks/useStores';
import { useStoreAdmin } from '@/hooks/useStoreAdmin';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { isStoreData } from '@/lib/dicoloreRefresh';
import { isAndroidApp } from '@/lib/nativeAndroid';
import { isScopedReportKey, REPORT_FAMILIES, reportFromPath, type DicoloreReport } from '@/lib/dicoloreReportCache';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';

const LABELS: Record<DicoloreReport, string> = { pedidos: 'Pedidos', notas: 'Notas Fiscais', titulos: 'Títulos', resultados: 'Resultados' };

/** One question per navigation entry; resume/focus never changes the decision. */
export default function DicoloreReportBoundary({ children, report: explicitReport }: { children: ReactNode; report?: DicoloreReport }) {
  const location = useLocation();
  // This context enables APK local-first queries, not general store identification.
  const isDicolore = location.pathname.split('/')[1] === 'dicolore' && isAndroidApp();
  const { data: store } = useStoreBySlug(isDicolore ? 'dicolore' : '');
  const access = useStoreAdmin(isDicolore ? store?.id : undefined);
  const restoring = useIsRestoring();
  const online = useOnlineStatus();
  const client = useQueryClient();
  const report = explicitReport ?? reportFromPath(location.pathname);
  const scope = JSON.stringify([access.user?.id, access.isAdmin, access.role, [...access.staffSellerCodes].sort(), access.erpCode, access.permissions]);
  const ready = isDicolore && !!store?.id && !!access.user && !access.loading && !access.accessError && !restoring;
  const entry = `${location.key}:${store?.id}:${scope}:${report}`;
  const [choice, setChoice] = useState<{ entry: string; approved: boolean } | null>(null);
  const decided = choice?.entry === entry;
  const approved = decided && choice?.approved === true;
  const matches = useCallback((query: { queryKey: readonly unknown[] }) => !!report && !!store?.id
    && isStoreData(query.queryKey, store.id, REPORT_FAMILIES[report]) && isScopedReportKey(query.queryKey, scope), [report, store?.id, scope]);
  const cache = client.getQueryCache();
  const subscribe = useCallback((callback: () => void) => cache.subscribe(callback), [cache]);
  const snapshot = useCallback(() => {
    const queries = cache.getAll().filter(q => matches(q) && q.getObserversCount() > 0);
    const saved = queries.filter(q => q.state.data !== undefined).map(q => q.state.dataUpdatedAt);
    return `${saved.length ? Math.min(...saved) : 0}|${queries.some(q => q.state.status === 'error')}`;
  }, [cache, matches]);
  const [savedAt, failed] = useSyncExternalStore(subscribe, snapshot, snapshot).split('|');
  const fetching = useIsFetching({ predicate: matches }) > 0;
  const update = async () => {
    if (!online || !ready || fetching) return;
    // Mark even cached data stale without starting a request before approval.
    await client.invalidateQueries({ predicate: matches, refetchType: 'none' });
    if (approved) await client.refetchQueries({ predicate: matches, type: 'active' }, { cancelRefetch: false });
    else setChoice({ entry, approved: true });
  };

  return <DicoloreReportContext.Provider value={{ isDicolore, scope, ready, report, approved }}>
    {isDicolore && report && ready && <>
      <AlertDialog open={!decided} onOpenChange={open => { if (!open) setChoice({ entry, approved: false }); }}>
        <AlertDialogContent className="max-w-[calc(100%_-_2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{LABELS[report]}</AlertDialogTitle>
            <AlertDialogDescription>Deseja atualizar os dados agora?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setChoice({ entry, approved: false })}>Não, usar dados salvos</Button>
            <Button disabled={!online} onClick={() => void update()}>Sim, atualizar</Button>
          </AlertDialogFooter>
          {!online && <p className="text-sm text-muted-foreground">Sem conexão. A atualização ficará disponível quando a conexão voltar.</p>}
        </AlertDialogContent>
      </AlertDialog>
      <div className="container flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{fetching ? 'Atualizando dados…' : Number(savedAt) ? `Dados salvos em ${new Date(Number(savedAt)).toLocaleString('pt-BR')}` : 'Ainda não há dados salvos para esta consulta.'}</span>
        <Button size="sm" variant="ghost" disabled={fetching || !online} onClick={() => void update()}><RefreshCw className={`mr-1 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />Atualizar dados</Button>
        {failed === 'true' && <p className="basis-full text-destructive">Não foi possível atualizar. Os dados salvos foram preservados.</p>}
      </div>
    </>}
    {children}
  </DicoloreReportContext.Provider>;
}