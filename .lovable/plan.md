
# Atualização de Clientes via Planilha (Dicolore)

Adicionar um botão **"Atualizar Clientes"** ao lado de **"Importar Clientes"** na aba Clientes do admin da loja, com fluxo similar ao **"Atualizar Preços"** dos produtos.

## Diferença em relação a "Importar Clientes"
Hoje o `import-customers` só preenche campos vazios (não sobrescreve). A nova atualização vai **sobrescrever** os dados básicos quando o cliente já existe.

## Fluxo

1. Admin clica em **"Atualizar Clientes"** → abre dialog de upload.
2. Faz download do modelo (mesmas colunas do Importar) ou arrasta planilha Excel/CSV.
3. Sistema processa linha a linha:
   - **Match por `customer_code`** (com fallback por CPF/CNPJ, igual ao import atual).
   - **Cliente existe** → sobrescreve **Nome, WhatsApp, CPF/CNPJ**. Endereço e demais campos permanecem como estão (só preenche se vazios, opcional).
   - **Cliente não existe** → cria novo cliente automaticamente (mesma lógica do Importar Clientes).
4. Mostra tabela com resultado: criados / atualizados / erros, com contagem.

## Mudanças

### 1. Edge Function `supabase/functions/import-customers/index.ts`
- Aceitar novo parâmetro `mode: 'import' | 'update'` no body (default `'import'` para não quebrar o atual).
- Quando `mode === 'update'`:
  - Para clientes existentes, **sobrescrever** os campos: `name`, `whatsapp`, `cpf_cnpj` (quando informados na planilha).
  - Para clientes não encontrados, criar normalmente (mesma rotina já existente).

### 2. Novo componente `src/components/UpdateCustomersDialog.tsx`
- Baseado no `ImportCustomersDialog.tsx` (mesmo parser XLSX, mesmas colunas, mesmo template).
- Título: "Atualizar Clientes".
- Texto explicativo deixando claro que vai **sobrescrever** Nome, WhatsApp e CPF/CNPJ dos clientes existentes (match por código) e criar os que não existirem.
- Invoca `import-customers` com `body: { storeId, rows, mode: 'update' }`.
- Mesma UI de resultados (criados / atualizados / erros).

### 3. `src/pages/StoreAdminPage.tsx`
- Importar `UpdateCustomersDialog`.
- Adicionar estado `updateCustomersOpen`.
- Renderizar botão **"Atualizar Clientes"** com ícone `RefreshCw` antes do botão "Importar Clientes" na barra de ações da aba Clientes (mesmo padrão visual de "Atualizar Preços").

## Pontos técnicos
- Reaproveita toda a infraestrutura existente (parser XLSX, edge function `import-customers`, auth headers, RLS).
- Não cria nova tabela nem altera schema — só estende a edge function existente.
- Invalida a query `['store-customer-profiles', storeId]` ao final para refletir as mudanças na lista.
