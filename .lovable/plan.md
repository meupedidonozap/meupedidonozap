## Objetivo

Adicionar um botão **"Importar Planilha"** na aba de Regras de Desconto do painel da loja, permitindo atualizar todas as faixas de desconto de uma vez a partir de uma planilha Excel exportada do ERP.

## Estrutura esperada da planilha

Baseado na imagem enviada:

| Coluna | Conteúdo | Uso |
|---|---|---|
| Grupo do Produto | Ex: `148 - MATERIAL DE APOIO`, `2 - LINHA DICCO`, `32 - FLASH COLOR` | Nome do grupo (extraído após o `" - "`) |
| Produto | Sempre `Todos` | Ignorado |
| Qtde. Inicial | Ex: `6`, `12`, `24` | Vira `minQuantity` |
| Percentual | Ex: `5`, `10`, `15` | Vira `discountPercent` |

Linhas com `Grupo = Todos`, `Qtde. Inicial = 0` ou `Percentual = 0` serão ignoradas.

## Como o cruzamento vai funcionar

O sistema atual guarda cada regra com `groupId = nome do grupo` (ex: `ALISAMENTO`, `FLASH COLOR`). Na planilha, o nome vem prefixado pelo código do ERP (`32 - FLASH COLOR`).

Lógica de match:
1. Para cada linha da planilha, extrair o nome puro: tudo após o primeiro `" - "` → `FLASH COLOR`.
2. Procurar match **case-insensitive** entre as regras existentes (`store.settings.discountRules` filtradas por `type = 'group'`).
3. Se grupo já existe → atualiza/recria a faixa daquele grupo + qtd mínima.
4. Se grupo é **novo** → cria nova regra usando o nome puro como `groupId` e descrição automática `{percentual}% off` (mesmo padrão das demais).

## Estratégia de substituição

Para evitar duplicatas e regras órfãs, a importação faz **substituição completa das regras de tipo `group`**:

- Mantém intactas regras de outros tipos (`quantity`, `value` se houver).
- Substitui o conjunto de regras `group` pelo que veio da planilha.
- Antes de salvar, mostra um **diálogo de pré-visualização** com:
  - Quantas regras serão criadas/atualizadas
  - Quantos grupos novos
  - Quantas linhas ignoradas
  - Botões **Confirmar** / **Cancelar**

## Arquivos a alterar/criar

### 1. `src/components/ImportDiscountRulesDialog.tsx` (novo)
Diálogo com:
- Input de upload `.xlsx`
- Parse usando `xlsx` (já no projeto via `ImportProductsDialog`/`ImportCustomersDialog`)
- Tabela de pré-visualização das regras detectadas
- Botão "Confirmar Importação"

### 2. `src/pages/StoreAdminPage.tsx`
Adicionar botão **"Importar Planilha"** ao lado do "Salvar Regras" no card "Regras Cadastradas". Ao confirmar, chama `updateStore` salvando o novo array em `settings.discountRules`.

## Detalhes técnicos

- Reaproveita o padrão de leitura de Excel já usado em `ImportProductsDialog.tsx` (lib `xlsx` no client).
- Detecta colunas pelos nomes do cabeçalho (case-insensitive, normalizando acentos): `grupo do produto`, `qtde. inicial` (ou `qtd inicial`), `percentual`.
- Descrição é sempre regenerada como `{percent}% off`.
- Não toca em produtos, categorias nem cupons.
- Não exige migração de banco — tudo continua em `stores.settings` (JSONB).

## Fora do escopo

- Não cria/atualiza categorias ou produtos a partir desta planilha.
- Não importa a coluna `Produto` (assumida como sempre `Todos`).
