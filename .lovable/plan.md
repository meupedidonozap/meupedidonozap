

# Importacao de Produtos com Variantes para Lojas ACESSORIOS

## Problema Atual
A importacao via Excel cria apenas produtos simples (sem variantes). Lojas do tipo ACESSORIOS trabalham com variacoes de COR e TAMANHO, e o processo atual ignora essas informacoes.

## Formato do Arquivo Excel para ACESSORIOS

O padrao sera: **uma linha por variante**. Produtos com o mesmo Codigo serao agrupados automaticamente.

Exemplo de planilha:

```text
Codigo | Nome           | Descricao      | Categoria  | Preco  | Cor    | Tamanho | Estoque | SKU        | Ativo
001    | Camiseta Basic | Algodao 100%   | Camisetas  | 59.90  | Azul   | P       | 10      | 001-AZ-P   | Sim
001    | Camiseta Basic | Algodao 100%   | Camisetas  | 59.90  | Azul   | M       | 15      | 001-AZ-M   | Sim
001    | Camiseta Basic | Algodao 100%   | Camisetas  | 59.90  | Azul   | G       | 8       | 001-AZ-G   | Sim
001    | Camiseta Basic | Algodao 100%   | Camisetas  | 64.90  | Preto  | P       | 12      | 001-PR-P   | Sim
001    | Camiseta Basic | Algodao 100%   | Camisetas  | 64.90  | Preto  | M       | 20      | 001-PR-M   | Sim
002    | Bone Trucker   | Aba curva      | Bones      | 49.90  |        |         | 30      | 002        | Sim
```

- Linhas com o mesmo **Codigo** serao agrupadas em um unico produto com `has_variants = true`
- Linhas sem Cor/Tamanho serao importadas como produto simples
- O preco da primeira linha do grupo sera usado como `base_price`

## Alteracoes Necessarias

### 1. Passar o tipo da loja para o ImportProductsDialog

Adicionar a prop `storeType` ao componente para que ele saiba quando esta lidando com uma loja ACESSORIOS.

### 2. Expandir o mapeamento de colunas

Adicionar ao `COLUMN_MAP`:
- `cor` / `color` -> color
- `tamanho` / `size` -> size
- `estoque` / `stock` -> stock
- `sku` -> sku

### 3. Nova interface de dados parseados

Para lojas ACESSORIOS, as linhas do Excel serao agrupadas por codigo em uma estrutura:

```text
ParsedProductGroup {
  code: string
  name: string
  description: string
  category: string
  basePrice: number
  active: boolean
  hasVariants: boolean
  variants: { color, size, price, stock, sku }[]
  action: 'insert' | 'update'
  existingId?: string
  valid: boolean
  error?: string
}
```

### 4. Logica de agrupamento

Ao processar o arquivo:
- Agrupar linhas pelo campo Codigo
- Se o grupo tem mais de uma linha OU possui Cor/Tamanho preenchidos, marcar como `hasVariants = true`
- Cada linha do grupo vira uma variante
- A validacao exige Codigo obrigatorio para agrupamento

### 5. Logica de importacao com variantes

Para cada grupo:
- **Novo produto**: inserir na tabela `products` com `has_variants = true`, depois inserir cada variante em `product_variants`
- **Produto existente**: atualizar o produto e sincronizar variantes (deletar antigas, inserir novas)

### 6. Preview ajustado na tabela

Para lojas ACESSORIOS, a tabela de preview mostrara:
- Linha do produto (agrupador) em negrito
- Sub-linhas das variantes com recuo, mostrando Cor, Tamanho, Preco, Estoque, SKU
- Indicador de quantas variantes cada produto possui

### 7. Descricao de colunas atualizada

Quando a loja for ACESSORIOS, a descricao do dialog sera:
"Colunas: Codigo, Nome, Descricao, Categoria, Preco, Cor, Tamanho, Estoque, SKU, Ativo. Linhas com o mesmo Codigo serao agrupadas como variantes."

## Detalhes Tecnicos

### Arquivo modificado: `src/components/ImportProductsDialog.tsx`

Principais mudancas:
- Nova prop `storeType: StoreType`
- Tipo `ParsedProductGroup` para dados agrupados
- Colunas extras no `COLUMN_MAP` (cor, tamanho, estoque, sku)
- Funcao `groupRowsByCode()` que agrupa linhas em produtos com variantes
- Importacao em duas etapas: primeiro `products`, depois `product_variants`
- Tabela de preview com layout hierarquico (produto -> variantes)
- Para produtos existentes com variantes: deletar variantes antigas e re-inserir

### Arquivo modificado: `src/pages/StoreAdminPage.tsx`

- Passar `storeType={store.type}` para o `ImportProductsDialog`

### Nenhuma migracao de banco necessaria

As tabelas `products` e `product_variants` ja existem com todas as colunas necessarias.
