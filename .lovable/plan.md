# Pedido 417 (Senses): cliente não criado e pedido não amarra ao cadastro

## O que os dados mostram

- O pedido #417 (24/08 09:07) foi gravado com `origem = web` e está vinculado ao usuário **senses01@senses.com.br**, que é o usuário de vendedor "Repres Jorge" (representante 344). Ou seja: o pedido saiu pela vitrine com o **login do vendedor**, sem cliente selecionado no Modo Vendedor.
- Por isso o bloco de cliente do pedido tem só nome/CNPJ/endereço digitados no checkout: **não tem `customerCode` nem `sellerCode`**.
- Não existe nenhum cadastro em Clientes ligado a esse usuário. O checkout tenta criar/atualizar o cadastro, mas o erro dessa etapa é engolido silenciosamente (`console.warn`), então não sabemos ainda o motivo exato da falha — isso será verificado como primeiro passo.
- O cadastro criado manualmente hoje (17:13) tem CNPJ 18.670.724/0001-08, representante 344, **sem código de cliente, sem WhatsApp e sem usuário vinculado**.
- A amarração pedido → cliente hoje só tenta: mesmo usuário, mesmo código do cliente, ou mesmo telefone. Nenhum dos três casa neste caso — daí o pedido continuar "solto" mesmo depois de cadastrar o cliente.

## O que será feito

1. **Amarrar por CNPJ/CPF**: incluir o documento como critério de vínculo entre pedido e cadastro (antes do telefone). Assim o #417 já passa a mostrar o cliente, o representante e a tabela de preço corretos na aba Pedidos, na impressão e no XML.
2. **Não perder mais o cadastro do cliente**: quando o checkout não conseguir gravar o cadastro, mostrar aviso claro na tela (em vez de falhar em silêncio) e registrar o motivo, para o vendedor saber que precisa cadastrar. O pedido continua sendo gravado normalmente.
3. **Vendedor logado na vitrine sem cliente escolhido**: bloquear a finalização quando o usuário é vendedor da loja e não selecionou o cliente, com mensagem pedindo "Selecionar cliente". Isso evita o caso do #417, em que o pedido nasceu no nome do vendedor.
4. **Completar o pedido #417**: gravar no pedido os dados do cadastro FARMA MAIS (representante 344, tabela 11, CNPJ) para que a transmissão saia correta, e preencher o WhatsApp 4730806880 no cadastro do cliente.

## Detalhes técnicos

- `src/pages/StoreAdminPage.tsx` → `findOrderProfile`: nova etapa de match por `cpf_cnpj` normalizado (só dígitos), entre o match por código e o match por telefone; `resolveCustomerCode` mantém a preferência por documento.
- `src/lib/exportOrder.ts`: usar a mesma ordem de resolução (usuário > código > CNPJ > telefone) na busca do cadastro para XML/TXT, mantendo o `priceTable` gravado no pedido como fonte principal.
- `src/pages/CheckoutPage.tsx`:
  - o `catch` do `upsertProfile` passa a exibir `toast.warning` com a mensagem do erro;
  - `validateForm`: se `isSellerMode` (vendedor/televendas ativo) e não houver `selectedCustomer`, bloquear — a regra já existe, será validada em execução com o login `senses01` para confirmar por que não atuou neste pedido.
- Correção de dados (via SQL de dados, não schema): completar `whatsapp` do cadastro FARMA MAIS e o `customer` do pedido 417 com `customerCode`/`sellerCode`/`ie`/`transportadora` do cadastro.
- Verificação: reabrir a aba Pedidos da Senses e conferir que o #417 mostra cliente + representante, e baixar o XML Tinturaria para confirmar tabela 11 e dados do cliente.
