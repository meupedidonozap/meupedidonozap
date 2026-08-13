# Notificações de pedidos pendentes para o perfil ADMIN

Hoje o aviso de novo pedido só chega para vendedores/televendas: o card "Ativar notificações" só aparece quando o usuário está vinculado a um vendedor, e o envio busca somente os vendedores ligados ao código do cliente do pedido. O administrador da loja não recebe nada.

## O que muda

- O administrador da loja (e o superadmin) passa a ver o card "Ativar notificações" no painel, tanto no computador quanto no celular (com o app instalado na tela inicial no iPhone).
- Ao ativar, aquele aparelho é registrado como assinante do tipo "admin" da loja.
- Sempre que entrar um pedido com status pendente naquela loja, todos os aparelhos de admin recebem a notificação — independente de qual vendedor está vinculado ao cliente.
- Vendedores continuam recebendo apenas os pedidos da carteira deles (nada muda para eles).
- Vários aparelhos por admin (PC + celular) funcionam ao mesmo tempo; desativar afeta só o aparelho atual.
- O clique na notificação continua abrindo o painel da loja.

## Detalhes técnicos

1. Banco (migração):
   - `push_subscriptions.seller_id` passa a aceitar nulo e ganha coluna `kind text not null default 'seller'` (valores: `seller` | `admin`).
   - Índice/consulta por `store_id + kind` para o envio a admins.
   - Ajuste das políticas RLS para que o dono da inscrição (`user_id = auth.uid()`) leia/atualize a própria linha, mantendo `service_role` com acesso total.
   - `upsert_push_subscription` ganha o parâmetro `p_kind` (default `seller`) e passa a aceitar `p_seller_id` nulo, validando que o usuário tem acesso à loja.

2. Frontend:
   - `usePushNotifications`: novo hook `useMyPushRole(storeId)` que devolve `seller` (quando há `seller_id`) ou `admin` (via `store_admins` / `platform_admins`); `useEnablePush` envia `kind` e `seller_id` opcional; consulta de status deixa de exigir `sellerId`.
   - `PushNotificationsCard`: deixa de retornar `null` quando não há vendedor; exibe o card também para admin, com texto "Você será avisado de todos os pedidos pendentes desta loja".

3. Edge Function `notify-new-order`:
   - Além dos destinatários por `seller_code`, busca as inscrições ativas com `kind = 'admin'` do `store_id` do pedido e envia para elas.
   - Evita duplicidade de endpoint quando o mesmo aparelho é admin e vendedor.
   - Mantém a desativação automática de inscrições mortas (404/410).
