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

## 3. Pegar clientes novos (sem código ERP) — layout da view dw_cliente
GET /clientes?limite=50
Resposta: { "clientes": [ { "id_mpz", "codigo", "vendedor_codigo", "razao_social", "nome_fantasia",
  "cnpj", "rg", "fisica_juridica" (0=PF,1=PJ), "inscricao_estadual", "inscricao_municipal",
  "inscricao_rural", "suframa", "data_fundacao", "site", "tipo" (CL/AM), "telefone_geral_1",
  "telefone_geral_2", "email_nfe", "endereco_rua", "endereco_numero", "endereco_bairro",
  "endereco_cep", "endereco_complemento", "endereco_cidade", "endereco_uf", "situacao",
  "municipio_codigo_ibge", "estado_codigo_ibge", "endereco_entrega_rua", "endereco_entrega_numero",
  "endereco_entrega_bairro", "endereco_entrega_cep", "endereco_entrega_complemento",
  "endereco_entrega_cidade", "endereco_entrega_uf", "municipio_entrega__codigo_ibge",
  "estado_entrega__codigo_ibge", "data_cadastro", "observacao", "status", "cliente_grupo_codigo",
  "cliente_classificacao_codigo", "regiao_venda_codigo", "tabela_preco_codigo",
  "condicao_pagamento_codigo", "transportadora_codigo", "frete_codigo" ("0" = CIF, "1" = FOB, igual ao clifrepag),
  "total_limite_credito", "grupo_tributario_codigo", "regime_tributario", "forma_pagamento_codigo",
  "cnae", "latitude", "longitude", "isento_ipi", "isento_st", "isento_icms",
  "situacao_mpz", "ultimo_erro", "criado_em" } ] }
Mapeamento ERP (ve001a): codigo=clicod/clicodext, vendedor_codigo=clirepcod, razao_social=clirazsoc,
nome_fantasia=clinomfan, cnpj=clicgccpf, inscricao_estadual=cliinsest, fisica_juridica=clipes,
tabela_preco_codigo=clitabpre, condicao_pagamento_codigo=clitvecod, transportadora_codigo=clitracod,
frete_codigo=clifrepag, forma_pagamento_codigo=clicobcod, regiao_venda_codigo=cliregcod,
cliente_grupo_codigo=grempcod, cliente_classificacao_codigo=cliclassi, grupo_tributario_codigo=clinatcod,
regime_tributario=cliregtri, cnae=clicnae, email_nfe=cliemanfe, suframa=clisuf, total_limite_credito=clilimcre.
Entrega: ve001d (cliendent, cliendentn, clibaient, clicepent, clicoment, clicidentc, cliestent).

## 3b. Consultar um cliente pelo código ERP (mesmo layout)
GET /clientes/codigo/92751  ->  { "cliente": { ...mesmos campos acima... } }

## Pedidos: tipo de frete
Cada pedido em GET /pedidos traz "tipo_frete": "0" (CIF) | "1" (FOB) | null — mesmo código do clifrepag, gravar em pe001.pedfrepag (vem do cadastro do cliente).

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
