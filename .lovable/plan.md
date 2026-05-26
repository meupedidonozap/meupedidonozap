## Problema

No fluxo de Mesas (DELIVERY/Salão), hoje:
- Excluir todos os itens das comandas **não libera a mesa** — a sessão fica aberta para sempre.
- Não há forma de **trocar o cliente de mesa** sem perder os itens já lançados.

## Solução

Tudo dentro de `src/components/TableSessionDialog.tsx` + 1 hook novo em `src/hooks/useTables.ts`.

### 1. Botão "Liberar mesa" (fechar sessão sem pagamento)
- Novo botão no header do dialog, ao lado de "Pagar".
- Habilitado sempre que a sessão tem 0 itens ativos (`sessionTotal === 0` e nenhum item pendente).
- Confirma ("Liberar mesa X? A sessão será encerrada.") → chama `closeSession.mutateAsync(sessionId)` → fecha o dialog.
- Também cancela pedidos vinculados ainda não cancelados (status `pendente`/`preparando` viram `cancelado`) para não poluir a tela de pedidos.

### 2. Auto-sugestão ao excluir o último item
- Após `deleteItem.mutateAsync(...)` no handler do ícone Lixeira, se `items.length === 1` (estava deletando o último), exibir toast com ação: "Mesa vazia. Liberar?" → mesmo fluxo do botão acima.

### 3. Botão "Trocar de mesa"
- Novo botão no header ("Trocar mesa").
- Abre um sub-dialog listando mesas da loja que estão **livres** (sem sessão aberta) — usa `useTables(storeId)` + `useOpenSessions(storeId)` já existentes.
- Ao escolher a mesa destino: atualiza `table_sessions.table_id` da sessão atual para o novo `tableId` (mantém tabs/itens).
- Novo hook `useMoveSession()` em `useTables.ts`:
  ```ts
  update table_sessions set table_id = :newTableId where id = :sessionId
  ```
- Invalida `table_sessions` e fecha o dialog (o usuário reabre pela nova mesa).
- Também atualiza o `customer.name` ("MESA X · C…") dos pedidos vinculados via update simples para refletir o novo número.

## Fora do escopo

- Sem mudanças de schema/RLS — as policies atuais de `table_sessions` já permitem update por admins e usuários com `can_manage_tables`.
- Sem mexer em pagamento, cardápio, ou outras lojas/fluxos.

## Arquivos

- `src/hooks/useTables.ts` — adicionar `useMoveSession`.
- `src/components/TableSessionDialog.tsx` — botões "Liberar mesa" e "Trocar mesa", sub-dialog de seleção, sugestão pós-exclusão.
