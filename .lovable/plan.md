# Resultados multinível (Vendedor e Televendas)

## O que o usuário verá
A tela **Resultados** continua com os 4 quadros, mas cada quadro passa a ser clicável e abre uma análise detalhada. Novos quadros: **Atendimentos**, **Top 10 clientes** e **Top 20 produtos**.

### Comparativo padrão (usado em todos os quadros)
- **Mês corrente** x **mês anterior completo**.
- **Mesmo período em dias**: 01 até hoje do mês atual x 01 até o mesmo dia do mês anterior (ex.: 01/10–14/10 x 01/09–14/09).
- Indicador de variação: seta verde (alta) / vermelha (queda) com % e diferença.
- Gráfico de linha acumulado dia a dia (mês atual x anterior) + tabela por dia.

### Vendedor
1. **Pedidos** – quantidade de pedidos colocados, com o comparativo acima.
2. **Total vendido** – soma dos pedidos colocados, mesmo comparativo.
3. **Total faturado** – soma das notas fiscais (pelo vendedor da NF), mesmo comparativo.
4. **Atendimentos (check-in)** – visitas do dia, do mês, mês anterior, comparativo por dias (ex.: 20 visitados nos primeiros 14 dias do mês passado x 7 agora), **tempo total** e **média por visita**.
5. **Top 10 clientes** da carteira (por valor vendido no mês, com opção de mês anterior).
6. **Top 20 produtos** mais vendidos em quantidade para a carteira.

### Televendas
- Mesmas análises de **Pedidos** e **Total vendido**, mas considerando **somente os pedidos emitidos pelo próprio usuário televendas** (quem fez o pedido), não a carteira.
- Top 10 clientes e Top 20 produtos também baseados nos pedidos que ela emitiu.
- Sem quadro de atendimentos (não fazem check-in).

### Admin
Vê o consolidado da loja, com seletor de vendedor para ver a análise de um vendedor específico.

## Detalhes técnicos
- Nova função pura `src/lib/periodCompare.ts`: recebe lista de `{date, value}` e "hoje", devolve totais do mês atual, mês anterior, mesmo período até o dia, variação % e série acumulada por dia. Testes com datas fixas (ex.: hoje 14/10 compara 01/09–14/09).
- Fontes:
  - Pedidos/vendido (vendedor): `erp_orders` por `vendedor_codigo` da carteira (inclui pedidos feitos fora do MPZ) + pedidos MPZ ainda não transmitidos, sem duplicar pelo `erp_order_code`.
  - Faturado: `customer_invoices.vendedor_codigo` (representante da NF), respeitando `titlesCompany`.
  - Atendimentos: `customer_visits` do `seller_user_id`, usando `duration_seconds`.
  - Top produtos: `erp_order_items` dos pedidos da carteira no período.
  - Televendas: `orders` onde o criador é o usuário logado (`createdByUserEmail`/user_id), já gravado pela etiqueta "Quem fez".
- Componente novo `src/components/results/ResultsDrilldown.tsx` (diálogo/tela cheia com abas, gráfico recharts), responsivo para celular.
- Consultas limitadas aos 2 meses necessários; RLS existente já restringe à carteira.
