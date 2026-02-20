
# Corrigir Lentidão no Carregamento do Painel Administrativo

## Causa Raiz: Waterfall de Requisições Sequenciais

O painel demora porque as requisições são executadas em cascata — cada uma esperando a anterior terminar antes de começar. Visualmente:

```text
Tempo →→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→→
[1] useAuth (getSession)          ████░░░░░░░░░░░░░░
[2] useStoreBySlug                ░░░░████░░░░░░░░░░  (espera [1])
[3] useStoreAdmin (verifica RLS)  ░░░░░░░░████░░░░░░  (espera [1]+[2])
[4] useOrders, useProducts...     ░░░░░░░░░░░░████░░  (espera [3])
[Conteúdo visível]                ░░░░░░░░░░░░░░░░██  ~1,5s depois
```

## Soluções

### 1. Converter `usePlatformAdmin` para React Query (com cache)

Atualmente usa `useEffect` manual, sem cache. Cada vez que a página carrega, busca do zero. Com React Query, o resultado fica em cache e retorna instantaneamente na segunda visita.

**`src/hooks/usePlatformAdmin.ts`** — reescrever usando `useQuery`:

```typescript
export function usePlatformAdmin() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading: adminLoading } = useQuery({
    queryKey: ['platform-admin', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_admins')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // cache 5 minutos
  });

  return { user, isAdmin, loading: authLoading || (!!user && adminLoading) };
}
```

### 2. Paralelizar `useStoreBySlug` + `useAuth` no `StoreAdminPage`

O `useStoreBySlug` não precisa do usuário para buscar a loja — slug já está disponível na URL imediatamente. O `useStoreAdmin` pode começar a buscar em paralelo assim que tiver `user.id` E `store.id` (qualquer um que chegar primeiro ativa, o outro completa).

Nenhuma mudança de código aqui — o problema é que React Query já faz isso, mas o `useStoreAdmin` tem `enabled: !!user && !!storeId`, o que já é correto. A loja e o usuário são buscados em paralelo, mas a **verificação de admin** espera ambos.

### 3. Adicionar `staleTime` nos hooks mais usados

Sem `staleTime`, React Query considera os dados "stale" (desatualizados) imediatamente e refaz a requisição toda vez que a página é focada ou o componente remonta. Adicionando `staleTime: 30_000` (30 segundos), dados recentes são retornados do cache instantaneamente.

**Hooks a atualizar:**
- `src/hooks/useStores.ts` — `useStoreBySlug`
- `src/hooks/useStoreAdmin.ts` — verificação de admin
- `src/hooks/useOrders.ts` — lista de pedidos
- `src/hooks/useProducts.ts` — lista de produtos
- `src/hooks/useCategories.ts` — categorias

### 4. Mostrar skeleton de loading durante a autenticação no `StoreAdminPage`

Atualmente, enquanto `storeLoading` ou `adminLoading` estão ativos, a tela mostra apenas um spinner centralizado. O usuário não tem feedback de progresso. Substituir por um skeleton com a estrutura do painel (header + sidebar + cards) para dar a percepção de carregamento mais rápido.

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/usePlatformAdmin.ts` | Converter de `useEffect` manual para `useQuery` com cache de 5 min |
| `src/hooks/useStoreAdmin.ts` | Adicionar `staleTime: 5 * 60 * 1000` |
| `src/hooks/useStores.ts` | Adicionar `staleTime: 30_000` em `useStoreBySlug` e `useStores` |
| `src/hooks/useOrders.ts` | Adicionar `staleTime: 30_000` |
| `src/hooks/useProducts.ts` | Adicionar `staleTime: 30_000` |
| `src/hooks/useCategories.ts` | Adicionar `staleTime: 30_000` |

## Impacto Esperado

| Cenário | Antes | Depois |
|---|---|---|
| Primeira visita ao painel | ~1,5s em branco | ~0,8s (paralelo) |
| Segunda visita (cache ativo) | ~1,5s em branco | ~0,1s (cache instantâneo) |
| Trocar de aba e voltar | Rebusca tudo | Cache mantido por 30s |
| Admin page (plataforma) | Sem cache | Cache de 5 min |

## O que NÃO muda

- Nenhuma mudança de banco de dados
- Nenhuma mudança visual no painel (apenas o loading fica mais rápido)
- A segurança (RLS) continua funcionando igual — o cache é apenas client-side
