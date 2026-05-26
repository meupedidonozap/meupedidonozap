## Objetivo
Permitir que a loja **Dicolore** configure as **Formas de Pagamento** e as **Condições de Pagamento** com os códigos do ERP, para que:
- O cliente possa **escolher** essas opções no checkout.
- O **vendedor** possa **editar** essas escolhas ao alterar o status do pedido.
- O **XML de integração** use os códigos cadastrados.

## 1. Configurações (aba Configurações do admin da loja)

Adicionar dois novos blocos no painel admin da Dicolore (condicionados ao slug `dicolore` ou a uma flag em `settings`):

**Bloco "Formas de Pagamento (ERP)"**
- Lista editável (adicionar / remover / editar / ativar).
- Campos por item: `codigo` (texto/numérico, ex: 1, 3, 4, 5, 42), `descricao` (ex: CHEQUE, A VISTA, BOLETO BANCARIO, DEPÓSITO, CARTÃO DE CRÉDITO), `filial` (texto livre, default "*"), `ativo`.
- Pré-popular com os 5 itens da imagem 1.

**Bloco "Condições de Pagamento (ERP)"**
- Mesma estrutura: `codigo` (ex: 63, 47, 87, 310, 122, 71, 400, 84, 21, 3, 61, 30, 1...), `descricao` (ex: "1/30 S/J", "7 DIAS S/J", "30/45/60/75/90 S/J", "VENDA A VISTA"…), `filial` ("*"), `ativo`.
- Pré-popular com os 14 itens da imagem 2.

Armazenamento: dentro de `stores.settings` em dois arrays JSON: `formasPagamento[]` e `condicoesPagamento[]`. Sem migração de schema.

## 2. Checkout (cliente Dicolore)

Na página de checkout, quando a loja for Dicolore (ou tiver as listas configuradas):
- Substituir o seletor genérico de pagamento por **dois selects**:
  - **Forma de Pagamento** — lista as opções ativas (mostra "código - descrição").
  - **Condição de Pagamento** — lista as condições ativas.
- Persistir nos pedidos: `payment_method` recebe o código da forma; novo campo `payment_condition_code` (e descrições espelho para exibição) salvo em `orders.customer` ou em uma chave dedicada dentro de `items`/`observations`. Para evitar migração, salvar em `orders.customer.paymentFormaCodigo`, `paymentFormaDescricao`, `paymentCondicaoCodigo`, `paymentCondicaoDescricao` (jsonb já existente).

## 3. Edição pelo vendedor / admin

No diálogo de edição do pedido (`EditOrderDialog`) e/ou na tela de gestão de pedidos:
- Mostrar os mesmos dois selects (forma + condição), pré-preenchidos com o que veio do cliente.
- Permitir alterar e salvar; atualiza os mesmos campos em `orders.customer`.
- Disponível ao admin e a usuários com `can_manage_orders`.

## 4. XML de integração (`src/lib/exportOrder.ts`)

- Trocar o mapa fixo `PAYMENT_CODE` por:
  - `formaPagamento` = código salvo no pedido (vindo da config). Fallback: mapa atual.
  - Novo elemento `<condicaoPagamento>` no XML usando o código salvo.
- TXT export: incluir colunas extras com os dois códigos.

## 5. Escopo / fora de escopo

- Aplicar apenas ao fluxo da **Dicolore** (detecção por slug + presença das listas em settings). Demais lojas continuam com o fluxo atual (pix/boleto/cartão/dinheiro).
- Sem mudanças de RLS, sem migrações de banco.
- Sem alterações no fluxo de WhatsApp das outras lojas.

## Arquivos a alterar
- `src/pages/AdminPage.tsx` (ou novo `PaymentCodesTab.tsx` montado dentro da aba Configurações) — UI das duas listas.
- `src/types/index.ts` — tipos `PaymentForma`, `PaymentCondicao`.
- `src/pages/CheckoutPage.tsx` — selects condicionais.
- `src/components/EditOrderDialog.tsx` — selects para vendedor editar.
- `src/lib/exportOrder.ts` — usar códigos dinâmicos + `<condicaoPagamento>`.
- Seed inicial (uma vez, via UI ou util) com os valores das imagens.
