# Roadmap

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
- [ ] Separar notas pelo representante da NF e corrigir acesso aos itens históricos
- [ ] Validar isolamento por vendedor, televendas, cliente e administrador
- [x] Filtrar títulos por data mínima configurável de emissão ou vencimento sem apagar histórico
- [x] Autorizar títulos pelo código do cliente para cliente, vendedor da carteira, televendas e administrador
- [x] Integrar Notas Fiscais pela VIEW `dw_nota_fiscal` para cliente, vendedor, televendas e administrador
- Integração de pedidos MPZ -> ERP DiColore (Python): pendente teste no servidor
