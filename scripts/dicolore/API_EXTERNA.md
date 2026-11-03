# API Externa MPZ – DiColore

Endereço base:
https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/api-externa

Cabeçalho obrigatório em todas as chamadas:
x-api-key: <SUA CHAVE>
Content-Type: application/json

## 1. Pegar pedidos liberados para transmissão
GET /pedidos?limite=50
Resposta: { "pedidos": [ { "order_id": "...", "order_number": 650, "customer": {...}, "items": [...], ... } ] }
(Mesmo conteúdo que o integrador atual recebe.)

## 2. Confirmar pedido gravado no ERP
POST /pedidos/confirmar
{ "pedido_id": "<order_id>", "codigo_erp": "98960" }
Com erro: { "pedido_id": "<order_id>", "erro": "motivo" }
Vários: { "resultados": [ {...}, {...} ] }
Confirmado => status "Confirmado" no MPZ e não volta mais na lista.

## 3. Pegar clientes novos (sem código ERP)
GET /clientes?limite=50
Resposta: { "clientes": [ { "id_mpz", "nome", "cpf_cnpj", "ie", "whatsapp", "cep", "uf", "cidade",
  "bairro", "endereco", "numero", "complemento", "vendedor_codigo", "tabela_preco",
  "transportadora", "situacao", "ultimo_erro", "criado_em" } ] }

## 4. Devolver o código ERP do cliente
POST /clientes/confirmar
{ "id_mpz": "<id>", "codigo_erp": "93001", "nome": "...", "ie": "...", "vendedor_codigo": "12",
  "tabela_preco": 1, "transportadora": "..." }
Campos de dados são opcionais (só os enviados são atualizados).
Com erro: { "id_mpz": "<id>", "erro": "motivo" }  (cliente continua na lista)
Resposta: { "ok": true, "atualizados": [...], "falhas": [ { "id_mpz", "erro" } ] }
Código já usado por outro cliente da loja é recusado.

## Exemplo (curl)
curl -H "x-api-key: SUA_CHAVE" https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/api-externa/pedidos
