import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Sincroniza a "versão dos dados" da loja entre o servidor e o cliente.
 *
 * O admin pode marcar `stores.settings.dataVersion` com um novo timestamp para
 * forçar TODOS os usuários (logados ou não) a recarregar os dados (produtos,
 * preços, categorias, etc.) sem precisar deslogar nem limpar o carrinho.
 *
 * Estratégia:
 *  - Lê a versão atual do servidor ao montar, ao voltar o foco e a cada 60s.
 *  - Guarda em localStorage `dv_<slug>`.
 *  - Se a versão do servidor mudar em relação à versão local, invalida TODO o
 *    cache do React Query (carrinho é armazenado no CartContext/localStorage e
 *    NÃO é afetado), grava a nova versão e mostra um toast.
 */
export function useDataVersionSync(slug: string | undefined, storeId: string | undefined) {
  const qc = useQueryClient();
  const initialized = useRef(false);

  useEffect(() => {
    if (!slug || !storeId) return;
    const storageKey = `dv_${slug}`;
    let cancelled = false;

    const check = async () => {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('settings')
          .eq('id', storeId)
          .maybeSingle();
        if (error || !data || cancelled) return;
        const settings = (data.settings as Record<string, unknown> | null) || {};
        const serverVersion = String(settings.dataVersion ?? '');
        if (!serverVersion) return;

        const localVersion = localStorage.getItem(storageKey) || '';

        if (!initialized.current) {
          initialized.current = true;
          if (!localVersion) {
            localStorage.setItem(storageKey, serverVersion);
          } else if (localVersion !== serverVersion) {
            // Estava com versão antiga ao abrir → atualiza silenciosamente.
            localStorage.setItem(storageKey, serverVersion);
            await qc.invalidateQueries();
          }
          return;
        }

        if (localVersion !== serverVersion) {
          localStorage.setItem(storageKey, serverVersion);
          await qc.invalidateQueries();
          toast.info('Catálogo atualizado pela loja. Preços e produtos foram recarregados.');
        }
      } catch {
        // silencioso
      }
    };

    check();
    const interval = window.setInterval(check, 60_000);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [slug, storeId, qc]);
}

/**
 * Verificação síncrona usada antes de finalizar um pedido. Faz uma checagem
 * pontual: se a versão mudou, invalida o cache, atualiza localStorage e
 * retorna `true` (indicando que o cliente estava desatualizado).
 */
export async function ensureLatestDataVersion(slug: string, storeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('settings')
      .eq('id', storeId)
      .maybeSingle();
    if (error || !data) return false;
    const settings = (data.settings as Record<string, unknown> | null) || {};
    const serverVersion = String(settings.dataVersion ?? '');
    if (!serverVersion) return false;
    const storageKey = `dv_${slug}`;
    const localVersion = localStorage.getItem(storageKey) || '';
    if (localVersion !== serverVersion) {
      localStorage.setItem(storageKey, serverVersion);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}