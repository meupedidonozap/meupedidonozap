

# Dashboard: Filtro por Periodo com Calendario (Data Inicio / Data Fim)

## O que muda

Substituir os botoes de periodo fixo (Hoje, Este Mes, Este Ano, Todos) por **dois seletores de data com calendario**: **Data Inicio** e **Data Fim**.

O usuario abre um calendario para escolher a data inicial e outro para a data final. Os cards de estatisticas e a tabela de pedidos recentes sao filtrados pelo intervalo selecionado.

Por padrao, ao abrir o dashboard, nenhum filtro e aplicado (exibe tudo). O usuario pode definir qualquer intervalo personalizado.

---

## Detalhes Tecnicos

### Arquivo a modificar
- `src/pages/StoreAdminPage.tsx`

### Mudancas
1. Remover o estado `dashboardPeriod` e os botoes "Hoje / Este Mes / Este Ano / Todos"
2. Adicionar dois estados: `startDate: Date | undefined` e `endDate: Date | undefined`
3. Adicionar dois componentes DatePicker usando `Popover` + `Calendar` (shadcn) com `pointer-events-auto` no Calendar
4. Atualizar o `useMemo` de `filteredOrders` para filtrar por `createdAt >= startDate` e `createdAt <= endDate` (quando definidos)
5. Adicionar botao "Limpar" para resetar o filtro e voltar a exibir tudo
6. Usar `format` do `date-fns` para exibir as datas selecionadas no formato brasileiro (dd/MM/yyyy)

### Layout do filtro
```text
[ Data Inicio: dd/mm/aaaa ]  [ Data Fim: dd/mm/aaaa ]  [ Limpar ]
```

Cada campo abre um calendario popup ao clicar. A data fim nao pode ser anterior a data inicio.

