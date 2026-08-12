# Condição e Prazo de Pagamento no checkout da DiColore SENSES

## Causa confirmada

No banco, a loja `dicoloresenses` está com as listas de pagamento vazias (`formasPagamento`: 0 itens, `condicoesPagamento`: 0 itens). O painel parece "já configurado" porque o card mostra a lista sugerida (padrão) quando nada foi salvo, mas essas opções nunca foram gravadas. O checkout só ativa o fluxo ERP quando as duas listas existem salvas na loja — por isso ele continua exibindo PIX / Cartão / Dinheiro.

## O que muda

1. O fluxo de pagamento por códigos passa a valer para a SENSES pelo próprio identificador da loja (como já ocorre na DiColore), sem depender de as listas terem sido salvas. Assim o checkout exibe imediatamente **Condição de Pagamento** e **Prazo de Pagamento**, ambos obrigatórios, no lugar de PIX/Cartão/Dinheiro.
2. Enquanto nada for salvo no painel, as listas exibidas são as sugeridas (padrão); ao salvar no painel, valem exatamente os códigos cadastrados.
3. Nenhuma outra loja é afetada; as regras de exportação (XML/TXT/Bling) continuam iguais.

## Detalhes técnicos

- `src/lib/dicolorePayments.ts`: em `isDicoloreFlow`, aceitar também o slug `dicoloresenses` (`['dicolore','dicoloresenses'].includes(slug)`), mantendo o fallback atual por presença das listas em `settings`.
- Sem migração de banco. Recomendado, após o ajuste: abrir Configurações na SENSES, clicar em "Padrão" nas duas listas, ajustar os códigos do ERP e salvar para persistir.
