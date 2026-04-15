

# Adicionar rolagem na lista de categorias do sidebar

## Problema
O sidebar de categorias (Sheet lateral) nas lojas do tipo produto usa um `div` simples sem controle de overflow. Quando existem muitas categorias (como na DICOLORE), as categorias que ficam abaixo da tela ficam inacessiveis.

## Solucao

Envolver a lista de categorias em um `ScrollArea` do Radix (ja existe no projeto em `src/components/ui/scroll-area.tsx`), limitando a altura ao espaco disponivel na Sheet e permitindo rolagem suave.

### Arquivo: `src/pages/ProductStorePage.tsx`

- Importar `ScrollArea` de `@/components/ui/scroll-area`
- Envolver o bloco de botoes de categoria (linhas 197-208) em um `ScrollArea` com `className="flex-1 mt-6"` e altura maxima calculada para caber na Sheet
- Estrutura resultante:

```text
SheetContent (side="left", w-80, flex flex-col h-full)
  SheetHeader → "Categorias"
  ScrollArea (flex-1, overflow auto)
    div (space-y-1, p-1)
      button "Todos os Produtos"
      button categoria 1
      button categoria 2
      ...
  /ScrollArea
/SheetContent
```

- Ajustar o `SheetContent` para usar `flex flex-col` e garantir que o `ScrollArea` ocupe o espaco restante com `flex-1`
- A barra de rolagem aparece automaticamente quando o conteudo excede a area visivel

### Resultado
O sidebar de categorias vai ter rolagem suave quando houver muitas categorias, funcionando bem em telas pequenas e tablets.

