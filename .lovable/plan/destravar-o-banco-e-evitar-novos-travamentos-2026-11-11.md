# Destravar o banco e evitar novos travamentos

## O que vi agora
- O monitor de status de pedidos parou às 11:42 com "tempo esgotado" ao enviar para o MPZ (duas tentativas seguidas).
- O backend responde a testes simples, mas a fila de conexões do banco está indisponível: consultas reais não completam. É o mesmo quadro de travamento anterior.
- Ainda não confirmei a causa: os indicadores de uso (memória, conexões) não estão respondendo.

## Passos
1. **Reiniciar o backend** (fica fora do ar alguns minutos) e confirmar que voltou: abrir pedidos no painel e rodar uma consulta.
2. **Achar a causa** logo após voltar: ver as consultas mais lentas e os registros do banco dos últimos 30 min (bloqueios, consultas presas, excesso de conexões) — principalmente as chamadas dos integradores (status de pedidos, estoque, clientes) e a lista de 15 mil clientes do painel.
3. **Corrigir conforme a causa encontrada**, por exemplo:
   - índice faltando na consulta lenta;
   - limite de tempo nas funções que recebem dados do ERP, para uma chamada presa não segurar o banco;
   - integradores sem rodar ao mesmo tempo / lotes menores.
   - Se o problema for capacidade (memória ou conexões no limite), recomendar aumentar o tamanho do servidor do banco, com aprovação sua.
4. Confirmar que o monitor de status de pedidos volta a fechar ciclos "ok".

Nada muda para JEWOS/SENSES além do reinício, que é do backend inteiro.
