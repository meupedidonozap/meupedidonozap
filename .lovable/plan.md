# Condição e Prazo de Pagamento na DiColore SENSES

## O que muda

1. **Painel da SENSES → Configurações**: passa a exibir o card de códigos de pagamento (hoje exclusivo da DiColore), com duas listas editáveis:
   - **Condição de Pagamento (ERP)** — ex.: A VISTA, BOLETO BANCARIO, DEPÓSITO, CARTÃO DE CRÉDITO.
   - **Prazo de Pagamento (ERP)** — ex.: 1/30 S/J, 30/60 S/J, 30/60/90 S/J.
   Cada linha tem código do ERP, descrição, ativar/desativar e exclusão, além do botão "Padrão" para restaurar a lista sugerida.
2. **Checkout da SENSES**: quando as listas estiverem preenchidas, o cliente escolhe **Condição de Pagamento** e **Prazo de Pagamento** (ambos obrigatórios), no lugar das opções PIX/Boleto/Cartão/Dinheiro. Isso já funciona automaticamente porque o checkout ativa esse fluxo quando a loja tem as duas listas configuradas.
3. **Rótulos**: nas telas da SENSES, os dois campos aparecem como "Condição de Pagamento" e "Prazo de Pagamento" (na DiColore continuam "Forma de Pagamento" e "Condição de Pagamento", sem alteração).
4. As listas iniciam vazias na SENSES; basta clicar em "Padrão" e ajustar os códigos conforme o ERP, e salvar.

Nenhuma outra loja é afetada e as regras de exportação (XML/TXT/Bling) continuam iguais — os códigos escolhidos seguem sendo enviados nos mesmos campos.

## Detalhes técnicos

- `src/pages/StoreAdminPage.tsx` (~linha 2187): trocar `store.slug === 'dicolore'` por uma verificação de lista de slugs (`dicolore`, `dicoloresenses`) para renderizar `DicolorePaymentCodesTab`.
- `src/components/DicolorePaymentCodesTab.tsx`: títulos das duas listas passam a depender do slug — "Condição de Pagamento (ERP)" / "Prazo de Pagamento (ERP)" para `dicoloresenses`; textos atuais para `dicolore`. Estrutura salva em `settings.formasPagamento` e `settings.condicoesPagamento` permanece a mesma.
- `src/pages/CheckoutPage.tsx` e `src/components/EditOrderDialog.tsx`: apenas os `Label` dos dois selects passam a usar os rótulos por slug; `isDicoloreFlow` já libera o fluxo pela presença das listas em `settings`.
- Sem migração de banco: as listas ficam no JSON de configurações da loja.
