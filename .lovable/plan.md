## Objetivo
Adicionar configuração **Oferece entrega? (SIM/NÃO)** na loja. Quando NÃO, o checkout pede apenas Nome + WhatsApp (sem endereço, CEP, bairro, taxas).

## Mudanças

### 1. Tipo `StoreSettings` (`src/types/index.ts`)
- Adicionar campo `offersDelivery?: boolean` (default tratado como `true` para retrocompatibilidade — lojas existentes continuam pedindo endereço).

### 2. Admin da loja (`src/pages/StoreAdminPage.tsx`, aba Configurações)
- Adicionar Switch **"Oferece entrega?"** próximo aos campos de taxa de entrega / bairros.
- Quando desligado: desabilitar/ocultar visualmente os campos de taxa de entrega, bairros de entrega e frete dos Correios (não precisa apagar dados existentes, apenas não usar).
- Persistir em `settings.offersDelivery`.

### 3. Checkout (`src/pages/CheckoutPage.tsx`)
- Ler `offersDelivery = store.settings.offersDelivery !== false`.
- Quando `offersDelivery === false`:
  - Ocultar todo o Card "Endereço de Entrega" e o Card "Frete".
  - Forçar `deliveryFee = 0` e `deliveryType = 'retirada'` internamente.
  - Validação `required` = `['name', 'whatsapp']`.
  - Ao enviar pedido / mensagem WhatsApp: tratar como retirada (sem bloco de endereço, sem taxa).
  - Salvar perfil do cliente apenas com nome/whatsapp (campos de endereço vazios).
- Ajustar "Turno de Entrega" → manter (é horário desejado), mas o texto pode permanecer.

### 4. Pedido novo manual (`src/components/NewOrderDialog.tsx`)
- Quando `offersDelivery === false`: ocultar campos de endereço no formulário "Novo Cliente" e zerar taxa de entrega na revisão.

### 5. Sem migração de banco
- O campo vive dentro do JSONB `stores.settings`, não exige alteração de schema.

## Observações
- Default é "oferece entrega" para não quebrar lojas existentes.
- Para a loja PERFIL DELIVERY, o admin desliga o toggle e o checkout passa a pedir apenas Nome + WhatsApp.
