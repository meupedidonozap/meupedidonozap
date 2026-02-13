

# Escolha de Layout de Impressao (A4 ou Termico)

## Resumo

Ao clicar no botao de imprimir um pedido, em vez de imprimir direto no formato termico, aparecera um menu dropdown com duas opcoes: "Impressora Termica" e "Folha A4". O usuario escolhe e a impressao e gerada no layout correspondente.

---

## O que muda

### 1. `src/lib/printOrder.ts`

- Renomear a funcao `buildOrderHTML` atual para `buildThermalHTML` (layout termico 80mm, ja implementado)
- Criar uma nova funcao `buildA4HTML` com layout em pagina A4 completa: fonte maior, tabela com colunas, margens normais
- A funcao exportada `printOrder` passa a receber um terceiro parametro `layout: 'thermal' | 'a4'` e chama o builder correspondente
- Assinatura: `printOrder(order, storeName, layout)`

### 2. `src/pages/StoreAdminPage.tsx`

- Substituir o botao simples de impressao por um `DropdownMenu` com duas opcoes:
  - Icone de impressora como trigger
  - Item "Impressora Termica (80mm)" que chama `printOrder(order, store.name, 'thermal')`
  - Item "Folha A4" que chama `printOrder(order, store.name, 'a4')`

---

## Layout A4

O layout A4 tera:
- Fonte `Arial/sans-serif`, tamanho 12px
- Largura total da pagina (sem restricao de 280px)
- Cabecalho com nome da loja e numero do pedido
- Dados do cliente em bloco
- Tabela de itens com colunas: #, Nome, Codigo, Qtd, Preco Unit, Total
- Totais alinhados a direita
- Rodape com data de geracao

---

## Detalhes Tecnicos

### Arquivos modificados
- `src/lib/printOrder.ts` - adicionar `buildA4HTML`, renomear builder atual, atualizar assinatura de `printOrder`
- `src/pages/StoreAdminPage.tsx` - trocar `Button` por `DropdownMenu` na coluna de acoes dos pedidos

### Dropdown na tabela de pedidos

```text
[Icone Impressora v]
  ├─ Impressora Termica (80mm)
  └─ Folha A4
```

O componente `DropdownMenu` ja esta disponivel no projeto (`src/components/ui/dropdown-menu.tsx`).

