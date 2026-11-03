# API externa DiColore: pedidos liberados + clientes novos

Um endereço novo que uma ferramenta externa usa para (1) pegar pedidos liberados para transmissão e confirmar com o número do ERP, e (2) pegar clientes novos, cadastrá-los no ERP e devolver o código do ERP para o MPZ. Só para a DiColore, protegido por uma chave própria.

## Fluxo

```text
Ferramenta externa                       MPZ
  GET  /pedidos            ->  pedidos "Liberado p/ Transmissão" (cliente, itens, vendedor, televendas)
  POST /pedidos/confirmar  ->  {pedido_mpz, codigo_erp} => status Confirmado
                               ou {pedido_mpz, erro}    => grava erro, pedido continua pendente
  GET  /clientes           ->  clientes sem código ERP (cadastros novos / pendentes de envio)
  POST /clientes/confirmar ->  {id_mpz, codigo_erp, dados atualizados (nome, IE, endereço,
                               vendedor, tabela de preço, transportadora)}
                               => MPZ grava o código e os dados, cliente fica ativo/aprovado
```

## O que será feito

1. **Chave de acesso própria** para a ferramenta externa (separada da usada pelos scripts atuais), enviada no cabeçalho `x-api-key`. Gerada automaticamente e guardada com segurança.
2. **Novo serviço `api-externa`** com as 4 rotas acima, JSON simples, limite de 50 por chamada, campos em português.
   - Pedidos: mesmo conteúdo que o integrador atual já recebe (reaproveita a lógica de `orders-export`), sem alterar o integrador existente.
   - Confirmação de pedido marca Confirmado e não reenvia o mesmo pedido.
   - Clientes: lista quem ainda não tem código ERP; ao confirmar, grava o código, atualiza os dados enviados e evita duplicidade (recusa código já usado por outro cliente da loja).
3. **Marcação de cliente "enviado ao ERP"**: novos campos no cadastro do cliente (data de envio ao ERP e último erro), para a lista não repetir clientes já confirmados e para mostrar erros.
4. **Documentação** para a ferramenta externa (exemplos de chamada e resposta) em `scripts/dicolore/API_EXTERNA.md`, com o conteúdo completo enviado no chat.
5. **Teste** de cada rota: chave errada recusada, lista de pedidos, confirmação, lista de clientes e devolução do código.

## Detalhes técnicos

- Edge function `supabase/functions/api-externa/index.ts`, `verify_jwt=false`, valida `x-api-key` contra secret `EXTERNAL_API_TOKEN` (generate_secret), slug fixo `dicolore`, rotas por path, validação com Zod, service role.
- Extrair o montador de payload de pedidos de `orders-export` para `_shared/dicoloreOrderPayload.ts` e usá-lo nas duas funções (comportamento atual de orders-export inalterado).
- Migração: `customer_profiles` + `erp_sent_at timestamptz`, `erp_error text`; índice parcial `(store_id) WHERE customer_code = ''` ou equivalente. Seleção de clientes: `customer_code` vazio e `erp_sent_at IS NULL`.
- Confirmação de cliente: checa unicidade de `customer_code` na loja, atualiza perfil, `approval_status='approved'`, `is_active=true`.
- Registrar a regra em AGENTS.md.
