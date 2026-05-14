## Objetivo

1. Tabela **Clientes Cadastrados**: adicionar 2 colunas após "Nome" → **CPF/CNPJ** e **Representante** (nome do vendedor associado pelo código).
2. Tabela **Vendedores (WhatsApp)** (Configurações Gerais): adicionar coluna **Código** após "Nome", editável.

## Banco de dados

Adicionar coluna `code` (text, default '') na tabela `store_sellers`. O código é alfanumérico curto (ex.: "001", "A12") definido pelo admin da loja, usado para vincular ao `seller_code` do cliente e ao XML de exportação (`<codigoRepresentante>`).

## Frontend — `src/pages/StoreAdminPage.tsx`

### Tabela Vendedores (linhas ~1342-1382)
- Adicionar input "Código" no formulário de novo vendedor (entre Nome e WhatsApp).
- Adicionar coluna "Código" no header e no body, com edição inline (Input pequeno + botão salvar, ou edição direta no blur que chama `updateSeller.mutate({ id, code })`).

### Tabela Clientes (linhas ~1466-1483)
- Header: inserir `<TableHead>CPF/CNPJ</TableHead>` e `<TableHead>Representante</TableHead>` após "Nome".
- Body: 
  - `<TableCell>{cp.cpfCnpj || '—'}</TableCell>`
  - `<TableCell>{sellerByCode.get(cp.sellerCode)?.name || '—'}</TableCell>`
- Criar `const sellerByCode = useMemo(() => new Map(sellers.map(s => [s.code, s])), [sellers])` (usando `useAllStoreSellers` para incluir inativos).
- Atualizar `colSpan` da linha vazia de 5 → 7.

## Hooks — `src/hooks/useStoreSellers.ts`

- Adicionar `code: string` à interface `StoreSeller`.
- Permitir `code` em `useCreateStoreSeller` e `useUpdateStoreSeller`.

## Export XML — `src/lib/exportOrder.ts`

Sem mudanças funcionais; o `sellerCode` já é usado como `<codigoRepresentante>`. O novo campo `code` em `store_sellers` é a fonte de verdade do código a ser cadastrado em cada cliente.

## Fora do escopo

- Não alterar fluxo de checkout / seleção de vendedor.
- Não alterar exportação XML/TXT (já consome `seller_code` do cliente).
