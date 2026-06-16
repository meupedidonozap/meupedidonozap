
## Diagnóstico do pedido #283

A regra realmente é UMA SÓ (`computeGroupDiscounts` em `src/lib/groupDiscounts.ts`): para cada grupo, escolhe a faixa de qtd. e aplica o % naquele grupo. **Não há duplicação no cálculo**, mas há duplicação na **apresentação**, e foi isso que confundiu.

Recalculando o pedido #283 com as regras atuais salvas em `stores.settings.discountRules`:

| Grupo | Qtd | % regra | Desc. R$ |
|---|---|---|---|
| OXIDANTES (OX 20+30) | 6 | 20% | 54,00 |
| SCULPT PENTEADOS | 7 | 5% | 25,55 |
| COLORAÇÃO | 15 | 10% | 32,85 |
| **LAVATORIO (LITRO)** | 3 | **5%** | **14,30** |
| **MATERIAL DE APOIO** | 3 | **99% (bonificação)** | **45,24** |
| TONALIZANTES | 2 | — | 0 |
| **Total** | | | **171,94** ✓ |

Bate exatamente com o `discount = 171,94` salvo. Ou seja, **não soma duas vezes** — o que falta é o sistema ter **estampado o `discountPercent` em todos os itens** (faltou em LAVATORIO e MATERIAL DE APOIO no JSON salvo do #283). Por isso, somando só os % visíveis no PDF dá 110,21 e parece "sobrar" 61,73 sem explicação.

### Por que algumas linhas ficaram sem `discountPercent`
Provável **race condition**: `itemDiscounts` é recalculado num `useEffect` do `CartContext`. Se o usuário clicar "Enviar" logo após mexer no carrinho, o `handleSendWhatsApp` lê um `itemDiscounts` ainda desatualizado. O `cart.quantityDiscount` também é atualizado nesse effect, mas como ele é usado direto da regra (`computeGroupDiscounts` roda sempre), o total fica certo enquanto as marcações por linha podem ficar incompletas.

## Plano de correção

Foco em **garantir paridade entre o que aparece linha-a-linha e o total**, sem mexer no cálculo (que está correto).

### 1. `src/pages/CheckoutPage.tsx` — calcular na hora
No `handleSendWhatsApp` e `generateOrderMessage`, em vez de ler `itemDiscounts` do contexto, chamar `computeGroupDiscounts(cart.items, discountRules)` na hora e usar o resultado retornado para:
- estampar `discountPercent` em cada item enviado ao `createOrder`
- somar `discount = couponDiscount + quantityDiscount` (mesmo número usado hoje)

Isso elimina o risco de estado defasado.

### 2. `src/lib/printOrder.ts` (e telas de visualização)
Adicionar logo acima do TOTAL uma linha explícita:

```
Subtotal ............... R$ 1.476,20
Desconto por quantidade  -R$   171,94
TOTAL ................. R$ 1.304,26
```

Assim, mesmo que o leitor faça a conta linha-a-linha, vê de onde vem cada centavo. A coluna "Preço unit." continua exibindo o `discountPercent` por item (informativo), mas a verdade do total fica explícita.

### 3. Validação visual no Checkout
No bloco de resumo já existe `cart.quantityDiscount`. Garantir que ele seja sempre mostrado quando > 0 (já está em `CheckoutPage.tsx:679` e `ProductStorePage.tsx:371`). Sem mudança funcional, só revisão.

### 4. Pedido #283 (opcional)
O pedido já existe com `discount = 171,94` correto, só faltam as marcações de % em 5 linhas. Posso rodar um update no `items` JSONB do #283 reestampando `discountPercent` pelos grupos, para o PDF re-emitido bater linha-a-linha. Confirme se quer.

## Arquivos a alterar
- `src/pages/CheckoutPage.tsx` — recálculo síncrono em `handleSendWhatsApp` e `generateOrderMessage`
- `src/lib/printOrder.ts` — linha "Desconto por quantidade" antes do TOTAL

## O que NÃO muda
- `src/lib/groupDiscounts.ts` (cálculo está certo)
- `src/contexts/CartContext.tsx` (lógica de uma única regra por grupo permanece)
- Regras em `stores.settings.discountRules`
