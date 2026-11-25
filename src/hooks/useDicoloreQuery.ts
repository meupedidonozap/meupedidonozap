import { useContext } from 'react';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { DicoloreReportContext } from '@/contexts/DicoloreReportContext';
import { LOCAL_REPORT_OPTIONS, reportForKey, scopedReportKey } from '@/lib/dicoloreReportCache';

/** A local search must keep the saved base query rather than create an empty remote key. */
export function useDicoloreRemoteTerm(term: string) {
  const state = useContext(DicoloreReportContext);
  return state.isDicolore && !state.approved ? '' : term;
}

/** Only report queries in DiColore are local-first and approval-gated. */
export function useDicoloreQuery<TQueryFnData = unknown, TError = Error, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, TError, TData, QueryKey>,
) {
  const state = useContext(DicoloreReportContext);
  const report = reportForKey(options.queryKey);
  const local = state.isDicolore && !!report;
  const automatic = state.isDicolore && ['store-customer-profiles', 'client-intel-base', 'client-intel-invoices', 'client-intel-mix'].includes(String(options.queryKey[0]));
  return useQuery<TQueryFnData, TError, TData, QueryKey>(local ? {
    ...options,
    ...LOCAL_REPORT_OPTIONS,
    queryKey: scopedReportKey(options.queryKey, state.scope),
    networkMode: 'online',
    enabled: state.ready && state.approved && state.report === report && options.enabled !== false,
  } : automatic ? {
    ...options,
    queryKey: scopedReportKey(options.queryKey, state.scope),
    gcTime: LOCAL_REPORT_OPTIONS.gcTime,
    refetchOnMount: 'always',
    enabled: state.ready && options.enabled !== false,
  } : options);
}