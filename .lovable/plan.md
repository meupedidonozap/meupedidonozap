## Problema

Pedido #308 da Dicolore fechou em R$ 393,90 mesmo com pedido mínimo configurado em R$ 400,00.

**Causa:** a validação de pedido mínimo compara `cart.subtotal` (valor sem desconto) com `minOrderValue`. O #308 tinha subtotal R$ 432,30 → passou no filtro → após o desconto por grupo (R$ 38,40) o total caiu para R$ 393,90, abaixo do mínimo.

## Correção

Trocar a base de comparação de `subtotal` para o **total já com desconto** (`subtotal - quantityDiscount`) nos 3 pontos onde a regra é aplicada:

1. `src/pages/CheckoutPage.tsx` (linha ~309) — bloqueio no `handleSendWhatsApp`.
2. `src/pages/CheckoutPage.tsx` (linhas ~733-754) — aviso "faltam R$ X" e `disabled` do botão finalizar.
3. `src/pages/ProductStorePage.tsx` (linhas ~376-392) — mesmo aviso/`disabled` no carrinho lateral da loja.

Fórmula usada nos 3 lugares:
```
const effectiveTotal = cart.subtotal - (cart.quantityDiscount || 0);
if (minOrder > 0 && effectiveTotal < minOrder) { ...faltam (minOrder - effectiveTotal)... }
```

Mensagem atualizada: "Pedido mínimo de R$ 400,00. Faltam R$ X em produtos (já considerando descontos)."

## Fora do escopo

- Não altero o cálculo do desconto em si.
- Não mudo pedidos já gravados (#308 permanece como está).
- Sem mudança de schema/backend — validação continua no client (o Checkout já roda `ensureLatestDataVersion` antes de enviar, o que é suficiente para este caso).
