# Monitor parando depois de transmitir

## O que o log mostra
- 14:43:36: pedido #522 gravado no ERP (98861) e confirmado no sistema. A transmissão funcionou.
- Depois disso o log fica em branco. O certo seria aparecer, a cada minuto, "Verificado: nenhum pedido pendente", e depois de 5 minutos a linha [status-pedidos].

## Causa provável
No Windows, se alguém clica dentro da janela preta (ou seleciona um texto), a janela entra no modo "Seleção" e **pausa o programa** até apertar Enter ou Esc. Esse é o motivo mais comum de o monitor "parar" sem dar erro.

Teste rápido: clique na janela e aperte **Esc** ou **Enter**. Se as linhas voltarem a aparecer, a causa é essa.

## Correção (pacote v7 do monitor)
1. O monitor desliga sozinho esse modo "Seleção" ao abrir. Clicar na janela não pausa mais nada.
2. Uma linha de "sinal de vida" a cada minuto, com o horário da próxima checagem de pedidos e de OF/NF. Assim fica claro que ele está rodando.
3. Se uma etapa passar do tempo limite, o log mostra qual foi, e o ciclo continua.
4. Entrego o ZIP v7 com o passo a passo de instalação. Os arquivos dicolore.env e importacao.env continuam como estão.

## Detalhes técnicos
- Na inicialização: desligar ENABLE_QUICK_EDIT_MODE via kernel32 SetConsoleMode, e usar flush nos logs.
- Mensagem "[monitor] ativo" a cada 60s, com o horário das próximas execuções.
- Revisar o loop de pedidos-erp: depois de transmitir, ele precisa agendar a próxima checagem e imprimir o "Verificado" normalmente.
