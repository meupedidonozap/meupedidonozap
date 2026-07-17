## Ajustes em `supabase/functions/sync-prices/index.ts`

### 1. Grupo: usar coluna G ("Des GRP"), não coluna F ("GRUPO")

Na planilha atual da Dicolore:
- Coluna F = `GRUPO` → código numérico (ex.: 40, 64, 148)
- Coluna G = `Des GRP` → nome descritivo (ex.: COLORAÇÃO, MATERIAL DE APOIO, DIVERSOS NACIONAL)

Hoje o código faz `grpIdx = header.findIndex(h => ["grupo","des grp","desgrp",...].includes(h))` — como "grupo" vem antes de "des grp" na varredura do header, ele casa com a coluna F e grava o **código numérico** como nome da categoria (por isso KIT086 aparece com categoria "148" na tela).

**Correção:** priorizar `des grp` / `desgrp` / `des_grp` na detecção. Só cair para `grupo` como último fallback (para planilhas antigas que só têm essa coluna). Ordem de busca:

1. `des grp`, `desgrp`, `des_grp`, `descricao grupo`, `descrição grupo`
2. `categoria`
3. `grupo` (fallback legado)

### 2. Preços: não replicar valores quando a planilha tiver 0/vazio

Hoje a função tem esta lógica de fallback:

```ts
const fallback = candidates[0];
const price1 = Number.isFinite(p1raw) && p1raw > 0 ? p1raw : fallback;
const price9 = Number.isFinite(p9raw) && p9raw > 0 ? p9raw : fallback;
```

Isso é o que fez KIT086 ficar com Tabela 1 = Tabela 9 = R$ 335 mesmo com a planilha marcando 0 nessas colunas. O usuário quer que os zeros da planilha sejam respeitados.

**Correção:** manter fallback **apenas** para Tabela 4 (que é a referência / `base_price`). Para Tabelas 1 e 9:

- Se o valor na planilha é > 0 → grava o valor.
- Se é 0 / vazio / inválido → grava `0` (ou `null`), sem herdar da Tabela 4.

Assim linhas 2 e 3 da planilha (produtos com `Preço 1 = 0`, `Preço 9 = 0`) passam a refletir 0 no banco, e a UI da vitrine já usa `resolveProductPrice` que cai para `basePrice` quando a tabela específica é 0 — o comportamento de exibição para visitantes/varejo (Tabela 4) fica preservado, e clientes de atacado com Tabela 1 ou 9 verão claramente que o produto não tem preço nessa tabela (ou, via fallback do helper, verão o `basePrice` — a decidir no item 3).

### 3. Alinhar decisão de exibição no front

Hoje `src/lib/pricing.ts` faz:

```ts
if (Number.isFinite(value) && value > 0) return value;
return Number(product.basePrice) || 0;
```

Ou seja, se Tabela 1 ficar 0, o cliente atacado acaba vendo `basePrice` (Tabela 4). Preciso confirmar com o usuário qual comportamento ele quer:

- **(A)** Cliente atacado com preço zerado na sua tabela → vê `basePrice` da Tabela 4 (comportamento atual do helper, mantém venda).
- **(B)** Cliente atacado com preço zerado na sua tabela → produto não pode ser comprado / aparece como "sob consulta" / é ocultado.

Vou assumir **(A)** por padrão (mantém a operação e nenhuma tela adicional muda). Se preferir (B), me avisa que ajusto `pricing.ts` e a listagem.

### 4. Rodar sincronização após o deploy

Depois do deploy da Edge Function, basta clicar em "Atualizar Preços" no painel da Dicolore para:
- Reprocessar todos os produtos com o nome de grupo correto (vindo da coluna G).
- Zerar `price_table_1` / `price_table_9` dos produtos cuja planilha tem 0 nessas colunas (ex.: KIT086).
- Consolidação de categorias duplicadas já existente na função vai limpar as categorias numéricas ("40", "148", etc.) que ficarem sem produtos.

### Fora de escopo

- Nenhuma migration de schema.
- Nenhuma mudança na UI do painel admin nem no fluxo de importação Excel manual.
- Regras de desconto e tabelas de preço por cliente continuam como estão.

### Verificação após deploy + clique em "Atualizar Preços"

- KIT086 (linha da planilha): grupo passa a ser a categoria nomeada da coluna G, `price_table_1` e `price_table_9` gravados conforme planilha (0 se estiver 0).
- Produtos de COLORAÇÃO / MATERIAL DE APOIO / DIVERSOS NACIONAL: categorias exibidas com nome, não com código numérico.
- Toast do botão continua mostrando contadores de preços/categorias/produtos atualizados sem 4xx/5xx.
