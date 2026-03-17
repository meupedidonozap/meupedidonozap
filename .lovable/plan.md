

# Ativar/Inativar e Excluir Clientes no Painel Admin

## Mudanças necessárias

### 1. Migração: adicionar coluna `is_active` na tabela `customer_profiles`
- `ALTER TABLE customer_profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;`
- Permite ativar/inativar clientes sem perder dados

### 2. Hook `useCustomerProfiles.ts`: adicionar mutações
- **Toggle ativo/inativo**: nova mutation `useToggleCustomerActive` que faz `UPDATE customer_profiles SET is_active = !current WHERE id = ?`
- **Excluir cliente**: nova mutation `useDeleteCustomerProfile` que faz `DELETE FROM customer_profiles WHERE id = ?`

### 3. Migração: RLS para DELETE em `customer_profiles`
- Adicionar policy: store admins podem deletar perfis de clientes da sua loja

### 4. UI em `StoreAdminPage.tsx` — aba Clientes
- Adicionar coluna **Status** na tabela (badge Ativo/Inativo)
- Botão de **toggle ativo/inativo** (ícone de switch) ao lado do botão editar
- Botão de **excluir** (ícone lixeira) que:
  - Verifica se o cliente tem pedidos (`orders`) ou ordens de serviço (`service_orders`) vinculadas (via `user_id` ou pelo campo `customer` JSONB)
  - Se tiver, mostra mensagem informando que não é possível excluir
  - Se não tiver, mostra confirmação e exclui
- A verificação de vínculos será feita via queries no banco antes de permitir a exclusão

### 5. Verificação de vínculos para exclusão
- Consultar `orders` onde `user_id = customer.user_id` OR `customer->>'name' = customer.name` (para clientes sem user_id)
- Consultar `service_orders` com lógica similar
- Se count > 0 em qualquer tabela, bloquear exclusão e sugerir inativar

