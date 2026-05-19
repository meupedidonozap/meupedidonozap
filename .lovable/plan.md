## Problemas e correções

### 1) Usuários não-admin não conseguem alterar o status do pedido

**Causa:** A política RLS atual da tabela `orders` (UPDATE) só permite `is_store_admin` (admin principal da loja). Usuários secundários como `morgana@dicolore.com.br`, mesmo com permissão `can_manage_orders = true`, são bloqueados pelo banco.

**Correção (migração):**
- Substituir a policy `"Store admins can update orders"` por uma versão que também aceite `has_store_permission(auth.uid(), store_id, 'can_manage_orders')`.
- Manter a regra de DELETE só para admin principal (não mexer).

### 2) Tela de Clientes só mostra parte dos 3.060 registros

**Causa:** O hook `useStoreCustomerProfiles` faz `select('*').eq('store_id', ...).order('name')` sem paginação. O Supabase aplica limite default de 1.000 linhas por requisição, então só chegam ~1.000 dos 3.047 registros da Dicolore.

**Correção (frontend, sem mudar UI muito):**
- Em `src/hooks/useCustomerProfiles.ts`, alterar `useStoreCustomerProfiles` para buscar em páginas de 1.000 em laço até esgotar (`.range(from, from+999)`) e concatenar tudo antes de retornar.
- Isso mantém a tela atual (busca + lista) funcionando com todos os clientes carregados. Sem mudança na UI.

### 3) Importação de planilha de clientes duplica em vez de atualizar

**Causa atual:** A edge function `import-customers` procura o cliente existente apenas por `customer_code`. Se a planilha trouxer códigos novos para um cliente que já existe (cadastrado por CPF/CNPJ), ou se o `customer_code` do banco estiver vazio (35 registros assim hoje), ele cria duplicado.

**Correção (edge function `import-customers`):**
- Para cada linha da planilha, antes de criar, procurar registro existente em `customer_profiles` (escopo `store_id`) com esta prioridade:
  1. Por `customer_code` (igual à planilha) — chave primária funcional Dicolore.
  2. Se não achou e `cpf_cnpj` da linha não estiver vazio: buscar por `cpf_cnpj` (normalizado, só dígitos).
- Se encontrar por qualquer uma das chaves, fazer **UPDATE somente dos campos enviados na planilha** (não sobrescrever com vazio campos opcionais ausentes), incluindo gravar/atualizar `customer_code` quando vier preenchido.
- Apenas quando nenhuma das chaves casar, criar novo registro + usuário auth.
- Marcar no retorno `status: 'updated' | 'created'` para o relatório do dialog.

Observação: o login auth é gerado a partir do `customer_code` (`{codigo}@{slug}.cliente.local`). Para registros antigos sem `customer_code` que forem casados por CPF/CNPJ, vamos preencher o `customer_code` no update e atualizar/gerar o usuário auth correspondente (sem quebrar o login existente do cliente).

## Arquivos a alterar

- `supabase/migrations/<novo>.sql` — recriar policy UPDATE de `orders`.
- `src/hooks/useCustomerProfiles.ts` — paginação interna no fetch.
- `supabase/functions/import-customers/index.ts` — lookup duplo (code + cpf_cnpj) e update incremental.

## Fora de escopo
- Nenhuma mudança visual na tela de Clientes ou de Pedidos.
- Permissões de edição de pedido continuam restritas ao filtro já existente por `seller_codes` no frontend.
