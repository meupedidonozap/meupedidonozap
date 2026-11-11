# Roadmap

## Atualização obrigatória por loja
- [ ] Corrigir detecção independente do sinal do navegador e acompanhar troca de loja
- [ ] Exigir atualização da loja afetada sem apagar carrinho ou sessão
- [ ] Testar detecção, direcionamento e atualização pela tela

## Baixa manual e recuperação de compra
- [x] Registrar pagamento manual com forma real e auditoria; manter trava do Bling; gravação e leitura pelo painel verificadas em orçamento temporário removido
- [x] Mostrar orientação fiel à recusa e recuperar carrinho sem duplicar cobrança; #732 consultado sem cancelamento; recuperação de pedido temporário verificada na tela
- [x] Restaurar Meus dados, senha e endereços fora da DiColore/SENSES; endereço temporário salvo e removido; bloqueio DiColore e celular verificados
- [x] Testar e publicar funções; 30 testes passaram; nenhuma cobrança real nem transmissão de teste

## Nova carga de clientes por vendedor
- [x] Aplicar tabela inicial por vendedor e preservar atribuições existentes no MPZ
- [x] Alinhar cadastros sem tabela dos demais vendedores; vendedor 28 recebe ERP na nova carga; 60 testes e chamada real sem gravações; função publicada
- [ ] Confirmar carga completa — depende de executar --tudo no servidor ERP

## Tabela de preço na sincronização de clientes
- [x] Normalizar tabelas de novos clientes, testar e publicar a correção no servidor (22 testes; chamada autenticada sem gravações)
- [ ] Confirmar carga dos clientes pendentes — depende do próximo ciclo do monitor no ERP

## Otimização da sincronização de clientes
- [x] Consultar somente clientes do lote e retirar criação de logins do envio ERP
- [x] Reduzir lotes para 250, adicionar tentativas e confirmar apenas registros sem erro
- [x] Testar, publicar a função e entregar monitor completo (13 testes; chamadas reais sem gravação e token inválido)
- [ ] Confirmar carga completa — depende de executar o monitor atualizado no servidor ERP

## Monitor de clientes pela dw_cliente
- [x] Ler public.dw_cliente sem alterar views e sem aceitar configuração antiga de mpz_cliente
- [x] Testar leitura, frete CIF/FOB e intervalo de 180 segundos; entregar código completo
- [ ] Confirmar execução real — depende de substituir e executar o monitor no servidor ERP do usuário

## Cadastro protegido DiColore e SENSES
- [x] Bloquear preenchimento e alteração de cadastro pelo cliente nas telas e na gravação
- [x] Usar cadastro oficial no pedido, mantendo acesso autorizado da equipe
- [x] Testar cinco regras de edição e direcionar aviso às duas lojas
- [ ] Confirmar pedido pela conta de um cliente dessas lojas — requer sessão desse cliente; não criar pedidos reais sem autorização

## Dados obrigatórios em todas as lojas
- [x] Exigir CPF/CNPJ válido, telefone com DDD e endereço completo no cadastro e pedido
- [x] Validar na gravação, preservar histórico e direcionar atualização a todas as lojas
- [x] Testar as regras e verificar bloqueio no checkout autenticado inclusive em retirada, sem criar pedidos

## Integração Super Frete JEWOS
- [x] Diagnosticar a rejeição do pedido #711 sem interromper o pedido ou o pagamento
- [x] Exigir os dados obrigatórios no checkout e preservar o detalhe dos erros do Super Frete
- [x] Validar três testes automatizados e o erro detalhado do #711 no painel autenticado
- [ ] Gerar a etiqueta do #711 após o admin informar o CPF/CNPJ no cadastro da cliente

## Finalização vendedor/televendas DiColore
- [x] Preservar forma e condição de pagamento ao editar (testes e restauração com resposta simulada)
- [x] Oferecer liberação desde a criação, mantendo clientes como pendente (regras testadas e confirmação simulada)
- [x] Disponibilizar PDF na confirmação; download verificado em desktop e visualização em celular
- [ ] Confirmar gravação e transmissão real por vendedor/televendas — requer pedido de teste autorizado para envio ao ERP

## Atualização do aplicativo instalado
- [x] Avisar quando uma nova versão estiver pronta e oferecer atualização no menu do vendedor
- [x] Validar detecção e preservação de carrinho/sessão com quatro testes e alerta no navegador
- [ ] Confirmar atualização entre versões no atalho instalado — depende de publicação e teste no celular

## Correção do monitor OF/NF v9
- [x] Preparar sincronização por dia, pedido individual, limites de tempo e atualização sem itens
- [x] Exibir progresso ao vivo no monitor e validar com seis testes automatizados
- [x] Entregar pacote de substituição e instruções
- [ ] Confirmar leitura do pedido 722199 e OF/NF na tela — depende de executar o pacote no servidor ERP do usuário

## Cadastro na transmissão DiColore
- [x] Priorizar cadastro pelo código transmitido e testar duplicados
- [x] Corrigir dados ausentes do pedido #524 e validar retorno real para o integrador (95773 / vendedor 46 / transportadora 175)
- [ ] Confirmar gravação do #524 no ERP — aguarda execução do monitor no servidor do usuário

- [ ] Criar e isolar a loja Mabelle com catálogo da DiColore
- [ ] Aplicar identidade e roteamento por domínio próprio
- [ ] Implementar cartão e Pix online em ambiente de teste
- [ ] Implementar cotação oficial dos Correios
- [ ] Validar loja, checkout e painel sem regressão na DiColore

## Força de Vendas DiColore
- [x] Motivo, observações e tempo total no registro de visitas
- [x] Botão Checkin/Checkout no Modo Vendedor com carteira do vendedor
- [x] Configurações no painel: período de não atendidos, distância máxima e motivos

## Financeiro ERP DiColore
- [x] Separar notas pelo representante da NF e corrigir acesso aos 8.496 itens históricos
- [x] Validar regras reais de vendedor/televendas/cliente, quatro testes e itens da NF 209426 no painel autenticado
- [x] Filtrar títulos por data mínima configurável de emissão ou vencimento sem apagar histórico
- [x] Autorizar títulos pelo código do cliente para cliente, vendedor da carteira, televendas e administrador
- [x] Integrar Notas Fiscais pela VIEW `dw_nota_fiscal` para cliente, vendedor, televendas e administrador
- Integração de pedidos MPZ -> ERP DiColore (Python): pendente teste no servidor

## Pagamento por cartão JEWOS
- [x] Bling só recebe pedidos com pagamento aprovado (automático e manual)
- [x] Gravar e exibir motivo da recusa do cartão (cliente e painel)
- [x] Cliente que desiste do pagamento: pedido cancelado e carrinho restaurado
