

# Corrigir Carregamento Lento e Erros de Dados

## Problemas Encontrados

### 1. ERRO: Coluna `created_at` nao existe na tabela `coupons` (CRITICO)

O hook `useCoupons` faz `.order('created_at')` na linha 13, mas a tabela `coupons` **nao tem** essa coluna. Isso causa um erro HTTP 400 que:
- Faz o React Query tentar 3 vezes (retry padrao), gerando 3 requisicoes falhadas
- Bloqueia o carregamento de cupons tanto na vitrine do cliente quanto no admin
- Gera latencia desnecessaria (3 x ~700ms = ~2 segundos desperdicados)

**Correcao:** Trocar `.order('created_at')` por `.order('expires_at')` em `src/hooks/useCoupons.ts`, linha 13.

### 2. Waterfall de requisicoes (LENTIDAO)

O fluxo atual e sequencial:

```text
StorePage: useStoreBySlug(slug) --> espera 760ms
           |
           v
ProductStorePage: useStoreBySlug(slug) [cache hit, ok]
                  useCategories(store.id) --|
                  useProducts(store.id)    --|-- paralelo, ~700ms
                  useCoupons(store.id)     --|-- ERRO 400 x3
```

Tempo total minimo: ~1.5s (store + dados). Isso e inevitavel com a arquitetura atual de hooks dependentes, mas o erro dos cupons adiciona ~2s extras.

### 3. Sem `refetchOnWindowFocus` global

O React Query refaz todas as queries quando o usuario troca de aba e volta. Para dados com `staleTime: 30_000` isso nao e problema, mas `useCoupons`, `useFoodItems` e `useStoreCustomerProfiles` nao tem `staleTime`, entao refazem a cada foco.

**Correcao:** Adicionar defaults globais no `QueryClient` em `src/App.tsx`.

---

## Plano de Mudancas

### Arquivo 1: `src/hooks/useCoupons.ts`

Linha 13: trocar `.order('created_at')` por `.order('expires_at')`.
Adicionar `staleTime: 30_000` ao hook `useCoupons`.

### Arquivo 2: `src/App.tsx`

Configurar `QueryClient` com defaults globais:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

Isso reduz retries de 3 para 1 (erros reais falham mais rapido) e evita refetch ao trocar de aba.

### Arquivo 3: `src/hooks/useFoodItems.ts`

Adicionar `staleTime: 30_000` para consistencia com os outros hooks.

### Arquivo 4: `src/hooks/useCustomerProfiles.ts`

Adicionar `staleTime: 30_000` ao hook `useStoreCustomerProfiles`.

---

## Impacto Esperado

| Metrica | Antes | Depois |
|---|---|---|
| Requisicoes de cupons | 3x 400 (erro) | 1x 200 (sucesso) |
| Tempo de carregamento | ~3.5s | ~1.5s |
| Refetch ao voltar de aba | Todas as queries | Nenhuma (dentro de 30s) |
| Retries em erro | 3 tentativas | 1 tentativa |

