## Objetivo

Substituir o fluxo de upload de planilha por uma sincronização automática (botão único) que lê a planilha do Google Sheets e atualiza/cria os clientes da Dicolore — espelhando como funciona "Atualizar Preços" hoje.

## Por que não está funcionando hoje

O importador atual (`ImportCustomersDialog` → Edge Function `import-customers`) só reconhece colunas `codigo, nome, cpf_cnpj, whatsapp, cep, uf, cidade, bairro, endereco, numero, complemento, codigo_vendedor`. A planilha do ERP da Dicolore usa os nomes originais (`clicod, clirazsoc, clicgccpf, clicel, clicep, cliest, clicid, clibai, cliend, cliendnum, cliendcom, clirepcod`), então todas as linhas viram inválidas e nada é gravado.

## Mudanças

### 1. Nova Edge Function `sync-customers` (espelha `sync-prices`)

- Recebe `{ store_id }` no body.
- Busca o CSV publicado da planilha da Dicolore (URL fixa no código, igual a `sync-prices`).
- Parser RFC 4180 reaproveitado de `sync-prices`.
- Mapeia colunas do ERP:
  - `clicod` → `customer_code`
  - `clirazsoc` → `name`
  - `clicgccpf` → `cpf_cnpj` (Cadastrar como vem do sistema)
  - `clicel` → `whatsapp` (só dígitos, conforme decisão)
  - `clicep` → `cep`
  - `cliest` → `uf` (2 chars uppercase)
  - `clicid` → `city`
  - `clibai` → `neighborhood`
  - `cliend` → `address`
  - `cliendnum` → `number`
  - `cliendcom` → `complement`
  - `clirepcod` → `seller_code`
- Filtro: usa apenas linhas com `clisit = 'A'` (ativos). Os demais ficam `is_active = false`.
- Para cada linha:
  - Busca em `customer_profiles` por `store_id + customer_code`.
  - Se existe: UPDATE preservando o `user_id` atual (não mexe no Auth, igual ao modo "update" atual).
  - Se não existe: INSERT com `user_id = null` (cliente cria login depois, ou usamos o fluxo de import original quando precisar).
- Usa `service_role` para escrever (igual `sync-prices`).
- Retorna `{ success, updated, created, deactivated, errors }`.

### 2. UI no admin da loja (`StoreAdminPage.tsx`)

- Na aba **Clientes**, quando `store.slug === 'dicolore'`:
  - Substituir os botões "Atualizar Clientes" e "Importar Clientes" por um único botão **"Atualizar Clientes"** (idêntico ao "Atualizar Preços").
  - Botão chama `supabase.functions.invoke('sync-customers', { body: { store_id: store.id } })`.
  - Mostra spinner enquanto sincroniza e toast com resultado (`X criados, Y atualizados, Z desativados`).
  - Invalida `['store-customer-profiles', store.id]`.
- Demais lojas continuam vendo os botões antigos (upload).

### 3. Pré-requisito do usuário

A URL que você enviou é o link de edição. Para o servidor ler, é preciso publicar a planilha:

1. No Google Sheets → **Arquivo → Compartilhar → Publicar na web**.
2. Selecionar a aba certa, formato **CSV**, e copiar a URL gerada (termina em `output=csv`).
3. Me envie essa URL para eu fixar dentro de `sync-customers` (igual ao `sync-prices`).

Sem essa URL pública, a Edge Function não consegue ler a planilha (o link `/edit?usp=sharing` exige login Google).

## Fora do escopo

- Não mexe na Edge Function `import-customers` nem no `ImportCustomersDialog` (continuam disponíveis para outras lojas).
- Não cria usuários no Auth durante o sync (mantém comportamento rápido do modo "update").
- Não toca em XML/exportOrder/fluxo do ERP de saída.

## Detalhes técnicos

- `supabase/functions/sync-customers/index.ts` (nova) — clona estrutura de `sync-prices/index.ts`.
- `supabase/config.toml` — adicionar `[functions.sync-customers]` com `verify_jwt = false` (igual `sync-prices`).
- `src/pages/StoreAdminPage.tsx` — adicionar estado `syncingCustomers`, handler `handleSyncCustomers`, e condicional `store.slug === 'dicolore'` na aba Clientes.