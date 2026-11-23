import { useEffect } from 'react';
import { useIsRestoring, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { refreshDicoloreData } from '@/lib/dicoloreRefresh';

/** Revalidate on a workflow boundary, never on a timer or every keystroke. */
export function useDicoloreRefresh(storeId: string | undefined, families: readonly string[], trigger: unknown = true) {
  const { slug } = useParams();
  const client = useQueryClient();
  const restoring = useIsRestoring();
  useEffect(() => {
    if (!restoring && trigger) void refreshDicoloreData(client, slug, storeId, families);
  }, [client, restoring, slug, storeId, families, trigger]);
}