# Corrigir acesso do Gerente (ornellas@dicolore.com.br)

## Causa confirmada
O cadastro de ornellas@dicolore.com.br na DiColore está com o papel **Auxiliar**, não **Gerente**. O menu (Vendas, Atendimento, Resultados) só aparece para Vendedor, Televendas, Gerente ou Administrador — por isso ele não vê.

Isso aconteceu porque o botão rápido **"👔 Gerente"** na tela de usuários marca só as permissões, mas não troca o campo **Papel**. O usuário fica parecendo gerente, mas continua salvo como Auxiliar.

## O que vou fazer
1. **Corrigir o ornellas agora:** mudar o papel dele para Gerente na DiColore (só esse usuário, só essa loja).
2. **Corrigir o botão "👔 Gerente":** ao clicar, ele passa a mudar também o Papel para Gerente, para não acontecer de novo com outros usuários.
3. Conferir entrando como ornellas que o menu aparece com Vendas, Atendimento, Resultados e Painel Admin.

Depois disso ele só precisa sair e entrar de novo (ou atualizar o app).

## Técnico
- `store_users.role` = 'gerente' para o registro do ornellas (store dicolore).
- `StoreUsersTab.tsx` linha ~409: preset chama `setRole('gerente')` + `setSellerCodes([])` além de `setPerms(GERENTE_PERMS)`.
- Nenhuma mudança para outras lojas.
