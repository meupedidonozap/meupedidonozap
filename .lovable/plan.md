
# Importacao de Produtos via Excel

## Resumo

Adicionar um botao "Importar Excel" na aba de Produtos do painel administrativo da loja. O lojista podera selecionar um arquivo `.xlsx` ou `.xls`, o sistema ira ler as linhas e criar os produtos em lote no banco de dados.

---

## Fluxo do Usuario

```text
Aba Produtos -> Botao "Importar Excel" -> Selecionar arquivo
    -> Preview da tabela com os dados encontrados
    -> Confirmar importacao
    -> Produtos criados em lote
```

## Formato esperado do Excel

O arquivo deve conter as seguintes colunas (nomes flexiveis, mapeados automaticamente):

| Codigo | Nome | Descricao | Categoria | Preco | Ativo |
|--------|------|-----------|-----------|-------|-------|
| SKU-01 | Camiseta | Camiseta algodao | Roupas | 49.90 | Sim |

- **Codigo**: opcional (coluna `code`)
- **Nome**: obrigatorio
- **Descricao**: opcional
- **Categoria**: nome da categoria (sera associada se existir)
- **Preco**: obrigatorio (coluna `base_price`)
- **Ativo**: opcional, padrao "Sim"

---

## Detalhes Tecnicos

### 1. Instalar dependencia

Adicionar a biblioteca `xlsx` (SheetJS) para parsing de arquivos Excel no navegador, sem necessidade de backend.

### 2. Criar componente `ImportProductsDialog`

Novo arquivo: `src/components/ImportProductsDialog.tsx`

- Dialog com input de arquivo (aceita `.xlsx`, `.xls`)
- Ao selecionar o arquivo, usa `xlsx` para ler as linhas
- Exibe preview em tabela com as primeiras linhas encontradas
- Mapeia colunas pelo nome (case-insensitive): "codigo/code", "nome/name", "descricao/description", "categoria/category", "preco/price", "ativo/active"
- Botao "Importar" que insere os produtos em lote via Supabase
- Exibe progresso e resultado (X produtos importados, Y erros)

### 3. Modificar `StoreAdminPage.tsx`

- Adicionar botao "Importar Excel" ao lado do botao "Novo Produto" na aba de produtos
- Abrir o `ImportProductsDialog` ao clicar
- Passar `storeId` e `categories` como props

### 4. Logica de importacao

- Para cada linha valida (com nome e preco), inserir na tabela `products` via supabase client
- Se a coluna "Categoria" tiver um nome que corresponda a uma categoria existente da loja, associar o `category_id`
- Categorias nao encontradas serao ignoradas (produto fica sem categoria)
- Inserir em lotes de 50 registros para performance
- Invalidar cache de produtos (`queryKey: ['products']`) ao finalizar

