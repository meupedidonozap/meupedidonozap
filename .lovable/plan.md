## Botão "Atualizar" nos painéis administrativos

Adicionar um botão **Atualizar** visível em todos os painéis admin para forçar refresh dos dados (sem precisar recarregar a página inteira).

### Comportamento
- Botão com ícone de refresh (`RefreshCw` do lucide-react) + texto "Atualizar".
- Ao clicar: invalida as queries do React Query da aba atual → recarrega dados do backend.
- Durante o refresh: ícone gira (animate-spin) e botão fica desabilitado.
- Toast de sucesso ("Dados atualizados") ao concluir.

### Onde adicionar
1. **`src/pages/StoreAdminPage.tsx`** — painel admin da loja (Pedidos, Produtos, Clientes, Categorias, Cupons, Vendedores, Configurações, etc.). Botão fixo no header do painel, ao lado do título/abas. Invalida as queries relevantes da aba ativa.
2. **`src/pages/AdminPage.tsx`** — painel super-admin (lojas, usuários da plataforma). Mesmo padrão.
3. **`src/components/SalonAdminTab.tsx`** — aba do salão (SERVICOS) com ordens de serviço. Botão dedicado para invalidar `serviceOrders` e dados relacionados.
4. **`src/components/StoreUsersTab.tsx`** — aba de usuários da loja. Botão para invalidar `storeUsers`.

### Detalhe técnico
- Usar `useQueryClient().invalidateQueries(...)` direcionado à aba ativa (chaves: `orders`, `products`, `customerProfiles`, `categories`, `coupons`, `sellers`, `serviceOrders`, `storeUsers`, `storeVisits`, `stores`, etc.).
- Criar componente reutilizável `src/components/RefreshButton.tsx` que recebe `queryKeys: string[]` e renderiza o botão padrão (variant `outline`, ícone à esquerda).
- Em `StoreAdminPage`, mapear a aba ativa → lista de query keys a invalidar; assim um clique atualiza só o que importa (mais rápido).

### Fora do escopo
- Não muda layout nem outras funcionalidades. Não altera storefront (somente painéis admin).
- Não implementa auto-refresh por timer (apenas manual via botão).

**Arquivos a alterar:** `src/components/RefreshButton.tsx` (novo), `src/pages/StoreAdminPage.tsx`, `src/pages/AdminPage.tsx`, `src/components/SalonAdminTab.tsx`, `src/components/StoreUsersTab.tsx`.
