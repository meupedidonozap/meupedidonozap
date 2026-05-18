# Pedido mínimo de R$ 400 (Dicolore)

## Objetivo
Impedir que pedidos abaixo de R$ 400,00 sejam finalizados na Dicolore, exibindo alerta claro com o valor que falta para atingir o mínimo.

## Abordagem
O campo `settings.minOrderValue` já existe na configuração da loja, mas hoje só é usado para cupons. Vou:
1. Reaproveitá-lo como **pedido mínimo geral da loja** (0 = sem mínimo).
2. Tornar editável no painel admin (aba Configurações).
3. Aplicar a validação no carrinho lateral e no checkout.
4. Definir `minOrderValue = 400` para a loja Dicolore.

Solução genérica/configurável (não hardcoded), assim qualquer outra loja pode usar a mesma regra no futuro.

## Mudanças

### 1. Painel Admin — aba Configurações (`StoreAdminPage.tsx`)
- Novo campo numérico **"Pedido mínimo (R$)"** junto da Taxa de entrega.
- Texto auxiliar: *"Deixe 0 para desativar. Pedidos abaixo deste valor não poderão ser finalizados."*
- Salva em `settings.minOrderValue`.

### 2. Carrinho lateral (`ProductStorePage.tsx`)
- Quando `subtotal < minOrderValue` (e `minOrderValue > 0`):
  - Bloco de alerta amarelo acima do botão Finalizar mostrando:
    > Pedido mínimo: R$ 400,00
    > Faltam **R$ X,XX** para finalizar.
  - Botão **"Finalizar Pedido"** fica desabilitado (mantém visual mas sem ação).

### 3. Página de Checkout (`CheckoutPage.tsx`)
- Mesmo alerta no resumo do pedido.
- Botão **"Enviar pelo WhatsApp"** desabilitado quando abaixo do mínimo.
- `handleSendWhatsApp` retorna early com `toast.error` se subtotal < mínimo (proteção extra).

### 4. Configuração da Dicolore
- Após o deploy, ajustar `minOrderValue = 400` em `stores.settings` da Dicolore (uma migration de update ou eu defino direto pelo painel novo).

## Detalhes técnicos
- Comparação contra `cart.subtotal` (antes de frete) — frete não conta para atingir o mínimo, evitando que o cliente seja "empurrado" por uma taxa.
- Helper local `const minOrder = store.settings?.minOrderValue || 0;` e `const missing = Math.max(0, minOrder - cart.subtotal);`.
- Alerta usa tokens do design system (sem cores hardcoded).

## Fora do escopo
- Aplicar mínimo em pedidos criados manualmente pelo admin (Novo Pedido) — pode ser adicionado depois se desejado.
- Aplicar mínimo via API externa (`criar-pedido` edge function).
