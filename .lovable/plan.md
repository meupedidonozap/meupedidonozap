
# Reorganizar Colunas de Itens — Separar Produto, Tamanho, Cor em Colunas Distintas

## Objetivo

Transformar a exibição de itens do pedido em todos os pontos de visualização para que cada atributo apareça em sua própria coluna, conforme a estrutura solicitada:

```
# | PRODUTO | TAMANHO | COR | QTD | PREÇO UNIT. | TOTAL
```

## Pontos de alteração

### 1. Impressão A4 — `src/lib/printOrder.ts` (`buildA4HTML`)

**Situação atual:** Tamanho e cor aparecem concatenados na coluna Produto: `Camiseta Super Mario (M, Amarelo)`

**Nova estrutura da tabela:**

| # | Produto | Código | Tam | Cor | Qtd | Preço Unit. | Total |
|---|---------|--------|-----|-----|-----|-------------|-------|
| 1 | Camiseta Super Mario | LS0007 | M | Amarelo | 3 | R$ 49,90 | R$ 149,70 |

Larguras otimizadas das colunas:
- `#` → 32px (center)
- `Produto` → flex (ocupa o restante)
- `Código` → 80px
- `Tam` → 50px (center)
- `Cor` → 70px
- `Qtd` → 40px (center, 3 dígitos)
- `Preço Unit.` → 85px (right, formato `R$ 99,99`)
- `Total` → 85px (right)

### 2. Impressão Térmica 80mm — `src/lib/printOrder.ts` (`buildThermalHTML`)

Na térmica, a largura é limitada (280px / 80mm), portanto colunas não cabem lado a lado. A abordagem ideal é manter o bloco por item mas exibir **Tam** e **Cor** em linhas dedicadas com rótulo claro, separados do Código:

```
1) Camiseta Super Mario
   Cod: LS0007
   Tam: M  |  Cor: Amarelo
   3 x R$ 49,90 = R$ 149,70
```

Isso já é quase o que existe, mas garantir que **sempre** apareçam Tam e Cor mesmo sem código, e que a linha de qtd/preço venha depois.

### 3. Painel Admin — Lista de Pedidos — `src/pages/StoreAdminPage.tsx`

**Situação atual:** A coluna "Itens" mostra apenas `2 itens`.

**Nova exibição:** Expandir para mostrar cada item com nome + tamanho + cor em linhas compactas:

```
Camiseta Super Mario — M / Amarelo
Camiseta Looney Tones 2 — P / Branco
```

A coluna fica com `min-w-[200px]` e fonte `text-xs` para caber na tabela. A mudança é na linha 480 do `StoreAdminPage.tsx`.

Também aplicar no **Dashboard — Pedidos Recentes** (linha 350), que atualmente também mostra só `X itens`.

### 4. "Meus Pedidos" do Cliente — `src/pages/OrderHistoryPage.tsx`

**Situação atual:** Tamanho e cor aparecem inline após o nome: `3x Camiseta Super Mario (M, Amarelo)`

**Nova exibição:** Manter inline mas com separação mais clara usando badges/chips visuais:

```
3x Camiseta Super Mario
   Tam: M  •  Cor: Amarelo
```

Usar `<div>` separados com `text-xs text-muted-foreground` para as variantes, abaixo do nome.

### 5. Resumo do Checkout — `src/pages/CheckoutPage.tsx`

**Situação atual:** Já mostra variantes em linha separada (alterado na última atualização), mas pode ser refinado para exibir com rótulos Tam/Cor mais claros.

**Nova exibição:**
```
3x Camiseta Super Mario       R$ 149,70
   Tam: M  •  Cor: Amarelo
```

### 6. WhatsApp / TXT — `src/lib/formatters.ts`

Mantém o formato atual `[M] [Amarelo]` concatenado no nome, pois o WhatsApp é texto puro sem colunas visuais. Porém pode ser melhorado para:

```
1 | LS0007 | Camiseta Super Mario | M | Amarelo | 3 | R$ 49,90 | R$ 149,70
```

Adicionando 2 campos intermediários na linha: Tamanho e Cor como colunas separadas por `|`.

## Arquivos modificados

| Arquivo | Seção | Mudança |
|---|---|---|
| `src/lib/printOrder.ts` | `buildA4HTML` | Nova tabela com colunas Tam e Cor separadas |
| `src/lib/printOrder.ts` | `buildThermalHTML` | Garantir Tam e Cor sempre exibidos em linha própria |
| `src/pages/StoreAdminPage.tsx` | Aba Pedidos (linha 480) | Mostrar itens com nome + variantes em vez de "X itens" |
| `src/pages/StoreAdminPage.tsx` | Dashboard Pedidos Recentes (linha 350) | Idem |
| `src/pages/OrderHistoryPage.tsx` | Lista de pedidos | Rótulos Tam/Cor em linha separada abaixo do nome |
| `src/pages/CheckoutPage.tsx` | Resumo lateral | Rótulos Tam/Cor mais claros |
| `src/lib/formatters.ts` | `generateWhatsAppMessage` | Colunas separadas para Tamanho e Cor na linha do item |
