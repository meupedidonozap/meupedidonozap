# Criar a loja Mabelle a partir da DiColore

## Objetivo

Criar a loja **MABELLE** como uma loja independente, usando a DiColore como base para estrutura, configurações, categorias e catálogo. A Mabelle terá checkout com pagamento online por **cartão e Pix** e cotação oficial de frete pelos **Correios**.

## O que será copiado

- Criar a loja com endereço `/mabelle`, tipo de loja e configurações visuais/operacionais baseadas na DiColore.
- Copiar as 26 categorias atuais da DiColore, preservando ordem e comissão.
- Copiar os 466 produtos atuais, incluindo preços, estoque, imagens, códigos, grupos, unidades, variantes, kits e vínculos entre kits e produtos.
- Recriar todos os relacionamentos usando os novos identificadores da Mabelle, sem compartilhar registros com a DiColore.
- Copiar as regras comerciais e de desconto existentes como configuração inicial.
- Não copiar pedidos, clientes, visitas ou histórico. Esses dados começarão vazios e separados.
- Não aplicar automaticamente comportamentos exclusivos dos endereços `dicolore` e `dicoloresenses`, como XML Tinturaria, códigos ERP ou Tabela 11.

## Pagamento online

- Ativar o pagamento integrado via **Stripe** em ambiente de teste, conforme confirmado.
- Disponibilizar cartão e Pix apenas na Mabelle e substituir a seleção meramente informativa atual por pagamento efetivo.
- Criar a cobrança com produtos, desconto e frete calculados no servidor, sem aceitar valores enviados diretamente pela tela.
- Criar ou atualizar o pedido a partir do retorno seguro do pagamento, registrando situação, identificador da cobrança e forma utilizada.
- Tratar estados de aguardando Pix, pago, recusado, expirado, cancelado e reembolsado, evitando pedidos duplicados.
- Mostrar ao comprador o QR Code/código Pix ou a etapa segura de cartão e uma confirmação clara após o pagamento.
- No Brasil, usar cálculo e coleta de imposto quando aplicável; cadastro, declaração e recolhimento permanecem sob responsabilidade da Mabelle.
- Após os testes, a Mabelle deverá reivindicar e verificar a conta para aceitar pagamentos reais.

## Frete oficial dos Correios

- Substituir, para a Mabelle, a estimativa regional atualmente usada pelo sistema por uma consulta oficial de PAC e SEDEX.
- Usar CEP de origem da Mabelle, CEP do cliente, peso e dimensões do pedido; validar CEP e limites aceitos pelos Correios.
- Permitir configurar no painel o CEP de origem, serviços habilitados e medidas/peso padrão de contingência.
- Exibir valor e prazo retornados oficialmente, exigir a escolha do serviço e incluir o frete no total antes da cobrança.
- Guardar no pedido o serviço, código, valor e prazo cotados para conferência administrativa.
- Preparar primeiro a integração e, quando o endereço de retorno estiver disponível, solicitar com segurança as credenciais oficiais dos Correios. Nenhuma credencial ficará exposta no site.
- Se os Correios estiverem indisponíveis, impedir uma cobrança com frete incorreto e oferecer nova tentativa, em vez de usar silenciosamente uma estimativa.

## Administração e segurança

- Vincular o administrador indicado à nova loja sem alterar os acessos da DiColore.
- Isolar catálogo, pedidos e configurações por loja nas regras de acesso existentes.
- Adicionar no painel da Mabelle a visualização do estado do pagamento e dos dados do frete.
- Validar notificações e atualização de estoque somente depois da confirmação do pagamento.

## Validação

- Conferir a quantidade e uma amostra de categorias, produtos simples, variantes, kits, imagens, preços, estoque e descontos entre DiColore e Mabelle.
- Testar cartão aprovado/recusado, Pix aguardando/pago/expirado, retorno do pagamento e prevenção de duplicidade.
- Testar PAC e SEDEX com diferentes CEPs e carrinhos, conferindo se o frete entra corretamente no total cobrado e no pedido.
- Verificar a loja e o painel em celular e computador, sem alterar o funcionamento da DiColore.

## Ordem de execução

1. Ativar o ambiente de teste do Stripe.
2. Criar e isolar a loja Mabelle, copiando configurações e catálogo.
3. Implementar pagamentos e confirmação segura.
4. Preparar a cotação oficial dos Correios e então solicitar as credenciais necessárias.
5. Executar os testes completos antes de liberar pagamentos reais.
