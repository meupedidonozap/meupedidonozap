# Conferir o pedido antes de "Liberado p/ transmissão"

## Problema
O pedido #570 foi liberado sem forma e sem condição de pagamento. O monitor do ERP recusou ("bloqueado: sem forma de pagamento; sem condição de pagamento"), mas o pedido ficou como "Liberado p/ transmissão" — um status em que ninguém mais o acompanha.

## O que muda
Ao escolher "Liberado p/ transmissão" (no painel da loja ou na tela do vendedor), o sistema confere o pedido antes de mudar o status. Se faltar algo:
- o pedido **continua Pendente**;
- aparece uma janela listando exatamente o que falta (ex.: "Falta forma de pagamento", "Falta condição de pagamento");
- botão **"Editar pedido"** abre direto a edição para completar.

Nada de WhatsApp é aberto enquanto o pedido estiver incompleto.

## O que é conferido (DiColore e Senses, que usam a transmissão)
1. Código do cliente no ERP (regra que já existe, agora na mesma lista).
2. Forma de pagamento.
3. Condição de pagamento.
4. Código do vendedor (mesma regra usada no XML).
5. Pedido com pelo menos 1 item, todos com código e quantidade maior que zero.

## Segurança extra
Uma trava no banco de dados recusa a mudança para "Liberado p/ transmissão" se faltar forma ou condição de pagamento, mesmo que alguém tente por outro caminho. Assim o pedido nunca fica liberado incompleto.

## Detalhes técnicos
- Novo `src/lib/orderReleaseCheck.ts`: `getReleaseIssues(order, store)` retorna lista de mensagens; usa `orderErpCustomerCode` e o resolutor de `orderSellerCode.ts`. Testes em `orderReleaseCheck.test.ts` (um por regra).
- `StoreAdminPage.tsx` (onValueChange do status) e `SellerPendingOrderDialog.tsx` (`release`): chamar o verificador antes do diálogo de confirmação/WhatsApp; se houver pendências, mostrar AlertDialog com a lista e botão para abrir `EditOrderDialog`.
- Garantir que a edição do pedido permita escolher forma/condição de pagamento (ver `EditOrderDialog.tsx`; adicionar os campos se não existirem).
- Migration: trigger `BEFORE UPDATE` em `orders` para lojas `dicolore`/`dicoloresenses`: se `NEW.status='liberado_transmissao'` e `customer->>'paymentFormaCodigo'` ou `customer->>'paymentCondicaoCodigo'` vazios, `RAISE EXCEPTION` com mensagem clara.
