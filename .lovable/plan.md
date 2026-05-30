## Diagnóstico

O botão laranja **"Lançar na Mesa"** (em `WaiterModeFAB.tsx`) **já cria 1 único pedido** com todos os itens do carrinho — a lógica está correta após o ajuste anterior.

O problema da segunda imagem (tela "Dados do Cliente") **não vem desse botão**. Ele vem da **barra verde "Ver Carrinho"** logo acima, que existe no storefront normal e leva para `/:slug/checkout`. Em Modo Garçom essa barra **não deveria aparecer** — o garçom não precisa preencher dados de cliente, ele só lança na mesa.

Arquivos com a barra verde + link "Carrinho" no menu inferior:
- `src/pages/FoodStorePage.tsx` (linhas 322-326 e 330-338)
- `src/pages/ProductStorePage.tsx` (linha 509 e link no nav inferior)
- `src/pages/PizzaStorePage.tsx` (linha 547 e link no nav inferior)

## Solução

Em cada uma das 3 páginas de storefront, detectar se há sessão de garçom ativa via `getWaiterSession()` e:

1. **Ocultar a barra flutuante verde "Ver Carrinho → /checkout"** (o garçom usa o botão laranja "Lançar na Mesa" do `WaiterModeFAB`).
2. **Ocultar o item "Carrinho" do nav inferior** (mesma razão — leva para checkout).
3. Manter o botão `+` nos produtos para adicionar itens normalmente ao carrinho.

Isso garante que o único caminho de finalização em Modo Garçom é o botão laranja, que já gera **1 pedido único** contendo todos os itens do carrinho (rotina de mesa, com `origem: 'mesa'`, observações "Mesa X - Comanda Y", e espelhamento na `tab_items`).

### Implementação

Em cada storefront:
```tsx
import { getWaiterSession } from '@/components/WaiterModeFAB';
// ...
const isWaiter = !!getWaiterSession();

// Esconder barra verde:
{totalItems > 0 && !isWaiter && (
  <div className="fixed bottom-20 ...">...Ver Carrinho...</div>
)}

// Esconder link Carrinho no nav inferior:
{!isWaiter && (
  <Link to={`/${store.slug}/checkout`}>...Carrinho...</Link>
)}
```

Sem mudanças em `WaiterModeFAB.tsx` (já consolida em 1 pedido), sem mudanças em `TableSessionDialog.tsx`, sem mudanças no backend.

## Arquivos alterados

- `src/pages/FoodStorePage.tsx`
- `src/pages/ProductStorePage.tsx`
- `src/pages/PizzaStorePage.tsx`
