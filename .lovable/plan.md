## Mudanças no XML da DICOLORE

Apenas para a loja `dicolore`, três ajustes no `src/lib/exportOrder.ts` e um novo campo de cadastro.

### 1. Tag `<pedidoTelevendas>` — S/N

Hoje envia `Sim` / `Nao`. Passa a enviar `S` / `N` apenas no fluxo Dicolore (demais lojas mantêm o texto atual, para não quebrar nada).

### 2. Tag `<perCom>` por item

Dentro de `<itensPedido>`, logo abaixo de `<valorTotal>`, incluir:

```
<perCom>1.00</perCom>
```

Formato com 2 casas decimais. Valor obtido a partir da **categoria** do produto:
- usa o `commissionPercent` cadastrado na categoria à qual o produto pertence;
- se a categoria não tiver percentual cadastrado, envia `0.00`.

### 3. Campo "Comissão %" no cadastro de Categorias

- Adicionar coluna `commission_percent NUMERIC(5,2) DEFAULT 0` na tabela `categories` (migração).
- Atualizar `useCategories` para ler/gravar o campo.
- Adicionar input "Comissão (%)" no diálogo de cadastro/edição de categorias dentro do painel admin da loja (`StoreAdminPage` → aba Categorias). Mostrar apenas quando `isDicoloreFlow(store)` for verdadeiro, para não poluir a UI das outras lojas.

### Arquivos afetados

- migração SQL: adiciona `commission_percent` em `categories`.
- `src/types/index.ts`: campo opcional `commissionPercent` em `Category`.
- `src/hooks/useCategories.ts`: mapear e persistir o novo campo.
- `src/lib/exportOrder.ts`:
  - `pedidoTelevendas` vira `S`/`N` quando Dicolore;
  - assinatura de `exportOrderXml` / `downloadOrderFile` recebe um mapa `categoryCommission: Record<categoryId, number>`;
  - novo `<perCom>` impresso após `<valorTotal>`.
- `src/pages/StoreAdminPage.tsx`: ao chamar `downloadOrderFile`, montar o mapa a partir das categorias carregadas e passar adiante; adicionar o campo no formulário de categoria (apenas Dicolore).

Sem mudanças em outras lojas, carrinho, preços ou pedidos já gravados.