# Atualizar Clientes — preservar clientes já cadastrados

## Problema

1. O fluxo atual de "Atualizar Clientes" reescreve dados sensíveis dos clientes existentes (chama `auth.admin.updateUserById` para resetar a senha, atualiza nome/whatsapp/cpf, e ainda propaga para "perfis irmãos" pelo WhatsApp). Isso **afeta** clientes já cadastrados — quebra logins e sobrescreve dados que o cliente possa ter ajustado pelo app.
2. A planilha tem 3022 linhas. O edge function processa em lotes de 50, e para cada cliente existente faz 1+ chamadas ao `auth.admin` (e até 20 páginas de `listUsers` no fallback). Isso estoura o tempo do edge function → "Edge Function returned a non-2xx status code".

## Objetivo

Em modo **Atualizar**:
- Cliente já existe (match por `customer_code` ou CPF/CNPJ) → **NÃO TOCAR** em nada. Pular a linha.
- Cliente não existe → cadastrar normalmente (cria auth user + profile, igual ao Importar).

Em modo **Importar** (existente): comportamento atual permanece (cria/atualiza tudo).

## Mudanças

### 1. `supabase/functions/import-customers/index.ts`
- Aceitar `mode: 'import' | 'update'` no body (default `'import'`).
- Quando `mode === 'update'`:
  - Após localizar `existingProfile` (por code, com fallback por CPF), se existir: **`continue`** com `status: 'skipped'` (não chama auth, não faz update no profile, não propaga para twins).
  - Se não existir: segue o mesmo caminho do Importar (cria auth user + insere profile).
- Reduzir batch para 25 no cliente para diminuir risco de timeout mesmo no caminho rápido.

### 2. `src/components/ImportCustomersDialog.tsx`
- Passar `mode` no `invoke` da função.
- Adicionar status `'skipped'` ao tipo `ResultRow` e mostrar contador "Ignorados (já existiam)".
- Atualizar textos do modo update: "Clientes existentes serão **ignorados**. Apenas novos clientes (não encontrados por código ou CPF/CNPJ) serão cadastrados."
- Reduzir `BATCH` de 50 para 25.

### 3. Sem mudanças de schema
Nenhuma migração necessária.

## Detalhes técnicos

- O match continua sendo: 1º `customer_code`, 2º fallback por dígitos de `cpf_cnpj`.
- Resposta da edge function passa a incluir `status: 'skipped'` para linhas ignoradas; o cliente conta e exibe.
- O bloco de propagação ("twins" por WhatsApp) só roda no modo `import` — no `update` nunca executa, garantindo zero efeito colateral.

## Resultado esperado
- 3022 linhas processadas sem timeout (a grande maioria será "skipped" em uma loja já populada, o que é instantâneo).
- Clientes existentes intactos: senhas, endereços e qualquer dado preservados.
- Apenas códigos novos viram cadastros novos.
