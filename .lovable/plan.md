

# Criar Cliente Manualmente na Aba Clientes (Lojas SERVICOS)

## Problema

A tabela `customer_profiles` exige `user_id` NOT NULL, mas clientes criados manualmente pelo admin nao possuem conta de usuario. Precisamos tornar `user_id` nullable e adicionar uma politica RLS para permitir que admins da loja insiram perfis.

## Mudancas

### 1. Migracao de Banco de Dados

- Tornar `customer_profiles.user_id` nullable (`ALTER COLUMN user_id DROP NOT NULL`)
- Adicionar politica RLS: "Store admins can insert customer profiles" (INSERT, `WITH CHECK` usando `is_store_admin`)
- Ajustar a politica de INSERT existente ("Users can insert own profiles") para aceitar `user_id IS NULL` quando admin

### 2. Hook: `src/hooks/useCustomerProfiles.ts`

Adicionar mutation `useCreateCustomerProfileAdmin` que insere um perfil com `user_id = null`, recebendo `storeId`, `name`, `whatsapp` e campos de endereco.

### 3. UI: `src/pages/StoreAdminPage.tsx`

- Adicionar botao "Novo Cliente" ao lado do titulo "Clientes Cadastrados" (visivel para lojas SERVICOS ou todas)
- Reutilizar o mesmo dialog de edicao de cliente, porem no modo criacao (titulo "Novo Cliente", campos vazios)
- Ao salvar, chamar `useCreateCustomerProfileAdmin` e invalidar a query

### 4. Interface `CustomerProfile`

Ajustar `userId` para `string | undefined` em `src/hooks/useCustomerProfile.ts` para acomodar perfis sem usuario.

## Fluxo do Admin

1. Admin abre aba "Clientes" → clica "Novo Cliente"
2. Preenche nome, WhatsApp e endereco
3. Salva → perfil aparece na lista
4. Pode abrir pedido/OS em nome desse cliente

