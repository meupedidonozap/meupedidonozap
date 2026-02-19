

# Modelo de Planilha Excel para Download

## Objetivo
Adicionar um botao no dialog de importacao que permite baixar um arquivo Excel modelo (.xlsx) com as colunas corretas ja preenchidas com exemplos, facilitando o preenchimento pelo usuario.

## Como vai funcionar

- Um botao "Baixar Modelo" aparecera na area de upload do arquivo, ao lado do botao "Escolher Arquivo"
- O modelo sera gerado dinamicamente no navegador usando a biblioteca `@e965/xlsx` (ja instalada)
- O conteudo do modelo muda conforme o tipo da loja:
  - **ACESSORIOS**: colunas Codigo, Nome, Descricao, Categoria, Preco, Cor, Tamanho, Estoque, SKU, Ativo (com linhas de exemplo mostrando agrupamento por codigo)
  - **Outras lojas**: colunas Codigo, Nome, Descricao, Categoria, Preco, Ativo (com linhas de exemplo simples)

## Exemplo de dados no modelo ACESSORIOS

| Codigo | Nome | Descricao | Categoria | Preco | Cor | Tamanho | Estoque | SKU | Ativo |
|--------|------|-----------|-----------|-------|-----|---------|---------|-----|-------|
| 001 | Camiseta Basic | Algodao 100% | Camisetas | 59.90 | Azul | P | 10 | 001-AZ-P | Sim |
| 001 | Camiseta Basic | Algodao 100% | Camisetas | 59.90 | Azul | M | 15 | 001-AZ-M | Sim |
| 001 | Camiseta Basic | Algodao 100% | Camisetas | 64.90 | Preto | P | 12 | 001-PR-P | Sim |
| 002 | Bone Trucker | Aba curva | Bones | 49.90 | | | 30 | 002 | Sim |

## Exemplo de dados no modelo simples

| Codigo | Nome | Descricao | Categoria | Preco | Ativo |
|--------|------|-----------|-----------|-------|-------|
| 001 | X-Burguer | Hamburguer com queijo | Lanches | 25.90 | Sim |
| 002 | Coca-Cola 350ml | Refrigerante | Bebidas | 7.50 | Sim |

## Detalhes Tecnicos

### Arquivo modificado: `src/components/ImportProductsDialog.tsx`

1. Criar funcao `downloadTemplate(isAccessories: boolean)` que:
   - Monta um array de objetos com dados de exemplo
   - Usa `XLSX.utils.json_to_sheet()` e `XLSX.utils.book_new()` para criar o workbook
   - Ajusta largura das colunas para melhor visualizacao
   - Usa `XLSX.writeFile()` para disparar o download com nome `modelo_importacao_produtos.xlsx`

2. Adicionar botao com icone `Download` ao lado do botao "Escolher Arquivo" na area de upload (quando nenhum arquivo foi selecionado ainda)

### Nenhum outro arquivo precisa ser alterado

A biblioteca `@e965/xlsx` ja esta instalada e suporta escrita de arquivos Excel.

