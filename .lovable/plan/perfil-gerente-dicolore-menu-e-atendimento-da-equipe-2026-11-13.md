# Perfil Gerente (DiColore): menu e Atendimento da equipe

Vale somente para a DiColore; outras lojas não mudam.

## O que muda
1. **Menu lateral**: o topo mostra "Gerente" (ou "Administrador") no lugar de "Vendedor", e aparece o item **Painel Admin** para ir direto à gestão.
2. **Atendimento**: para o Gerente/Admin, em vez do formulário de check-in, abre a **visão da equipe**:
   - Lista de check-ins de todos os vendedores: vendedor, cliente, entrada, saída, duração, motivo e observações.
   - Filtro por vendedor (todos ou um específico).
   - Filtro por período: hoje, 7, 30 ou 90 dias.
   - Resumo: total de visitas, clientes atendidos, tempo médio.
3. **Barra do catálogo**: o botão "Fazer Check-in" some para o Gerente.
4. Aviso de atualização só para a DiColore.

## Detalhes técnicos
- `SellerMenu.tsx`: rótulo por papel (`isManager`/admin) + link `/:slug/admin`.
- Rota de atendimento: se `isManager || isAdmin`, renderizar novo `TeamVisitsPanel` (consulta `customer_visits` + `customer_profiles` + `store_users`; leitura já liberada pela política `is_store_manager`).
- `SellerModeBar.tsx`: ocultar check-in quando `isManager`.
- `public/release.json` → stores ["dicolore"], nova release.
