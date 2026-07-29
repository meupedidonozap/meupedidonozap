## Objetivo

Deixar a rotina "Atualizar Produtos/Preços" da DiColore 100% alinhada à planilha nova (CODIGO / DESCRIÇÃO / GRUPO / PREÇOS 1-4-9), atualizando tudo que estiver diferente e já preparando uma 4ª tabela de preço reservada.

## O que verifiquei

- A rotina atual (`sync-prices`) lê uma planilha **publicada antiga** com URL fixa no código — não a planilha nova que você enviou. Testei o download da nova: ela não está acessível publicamente (retorna tela de login), então hoje ela não seria lida.
- Hoje a rotina **só atualiza preços e categoria**. Nome e descrição só são gravados quando o produto é criado — produto existente com nome diferente na planilha nunca é corrigido.
- Produtos que somem da planilha continuam ativos na loja.
- No banco existem apenas `price_table_1`, `price_table_4`, `price_table_9` (produtos e variações). Não há campo reservado para uma futura tabela.

## Plano

### 1. Acesso à planilha nova
Conectar o Google Sheets como conector do projeto e fazer a Edge Function ler a planilha `1u6a579_...` pela API autenticada (sem depender de "publicar na web"). Vou abrir o card de conexão para você autorizar a conta Google dona da planilha. Como alternativa de segurança, mantenho a leitura via CSV publicado caso a conexão falhe.

### 2. Reconhecimento das colunas
Detecção tolerante a acento/maiúsculas para:
- `procod` → código
- `Descrição PRoduto` → nome
- `Preço 1` / `Preço 4` / `Preço 9` → tabelas de preço
- `Des GRP` (prioritária) e `GRUPO` (fallback) → categoria
- coluna reservada futura (após Preço 9) → detectada mas **ignorada** por enquanto

### 3. Regras de atualização (produto existente)
Compara e atualiza somente o que estiver diferente:
- **Nome/descrição**: sempre sobrescrito pelo da planilha (fonte da verdade).
- **Categoria**: pelo nome de `Des GRP`, criando a categoria se não existir (comissão 1,00%).
- **Preços**: T1, T4, T9 conforme planilha; T4 também alimenta o `base_price`. Valor zerado/vazio nas tabelas 1 e 9 grava **0** (produto fica indisponível para aquela tabela, sem herdar preço de outra).

### 4. Produtos novos e ausentes
- Código na planilha e não no banco → cria o produto ativo, com nome, categoria e as três tabelas.
- Código no banco e não na planilha → **marca como inativo** (`is_active = false`), sem excluir; se voltar à planilha, é reativado automaticamente.

### 5. Tabela de preço reservada
Migração adicionando `price_table_res` (numérico, nulo) em `products` e `product_variants`, logo após a tabela 9. A rotina **não grava nada** nesse campo agora e o front continua trabalhando só com 1/4/9 — fica pronto para quando a planilha passar a enviar a nova coluna.

### 6. Relatório do resultado
O aviso no painel passa a mostrar, além de preços: nomes atualizados, grupos atualizados, produtos criados, produtos inativados e reativados.

## Detalhes técnicos

- `supabase/functions/sync-prices/index.ts`: leitura via gateway do conector Google Sheets (`/v4/spreadsheets/{id}/values/A:Z`) com fallback CSV; parser de cabeçalho normalizado; diff de nome/categoria/preços; update em lote; passo de inativação/reativação por diferença de conjunto de códigos; limpeza/merge de categorias vazias mantida como está.
- Migração: `ALTER TABLE public.products ADD COLUMN price_table_res numeric NULL;` e igual em `product_variants`.
- `src/pages/StoreAdminPage.tsx`: toast com os novos contadores.
- `src/lib/pricing.ts`: sem mudança funcional agora (a tabela reservada só entra quando ativada).
