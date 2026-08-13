# Exportar e reimportar produtos em massa (DiColore Senses)

Adicionar, dentro do diálogo **Importar Excel**, um botão **Baixar Produtos Salvos** que gera uma planilha com todos os produtos da loja na mesma estrutura aceita na importação — assim o ciclo baixar → ajustar → subir grava as alterações.

## O que será feito

1. **Botão "Baixar Produtos Salvos"**
   - Fica ao lado do botão de modelo, no topo do diálogo de importação.
   - Busca todos os produtos da loja atual (ativos e inativos) e gera o arquivo `produtos_<loja>_<data>.xlsx`.

2. **Estrutura completa da planilha** (uma linha por produto; lojas de variação geram uma linha por variação)
   - Codigo, Nome, Descricao, Categoria, Grupo
   - Unidade (Un, CX, etc.)
   - Preco1 (tabela 1), Preco (tabela 4), Preco9 (tabela 9), PrecoRes (tabela reservada)
   - Estoque, Ativo (Sim/Não), Kit (Sim/Não)
   - Nas lojas com variação, também: Cor, Tamanho, SKU
   - Colunas com largura ajustada e nomes idênticos aos reconhecidos na importação.

3. **Importação passa a gravar a estrutura completa**
   - Hoje a importação grava apenas nome, descrição, categoria e os preços 1/4/9.
   - Passa a gravar também: Grupo, Unidade, PrecoRes, Estoque e Ativo.
   - Colunas ausentes na planilha não sobrescrevem o valor atual do produto.
   - Preço zerado deixa de invalidar a linha: zero é gravado como zero (regra da DiColore de ocultar produto sem preço na tabela do cliente continua valendo). A linha só é inválida sem Nome.
   - Casamento continua por Código: existente = atualiza, novo = cria.

4. **Texto de ajuda do diálogo** atualizado para listar as colunas da estrutura completa.

## Detalhes técnicos

- `src/components/ImportProductsDialog.tsx`: nova função `downloadCurrentProducts(storeId, storeType)` usando `XLSX.utils.json_to_sheet`, consultando `products` (+ `product_variants` quando ACESSORIOS) e resolvendo o nome da categoria via prop `categories`.
- `COLUMN_MAP` ganha as chaves `grupo/group_id`, `unidade/unit`, `precores/preco res/tabela res`, `estoque`, `kit`.
- `parseSimpleRows` passa a ler os novos campos e a validação de preço é removida (mantida apenas a de nome).
- `handleImportSimple` inclui `group_id`, `unit`, `price_table_res`, `stock`, `is_active` nos updates/inserts.
- Nenhuma mudança de banco é necessária: todas as colunas já existem em `products`.
