
## Como funciona hoje

- A função `notify-new-order` (Web Push / VAPID) já existe e:
  - resolve o `seller_code` do cliente via `customer_profiles` (por `user_id` ou últimos 8 dígitos do WhatsApp);
  - via RPC `get_order_recipients`, busca o vendedor titular **+ televendas** que atendem aquele código;
  - envia push para todas as assinaturas ativas em `push_subscriptions` daqueles `seller_id`.
- A função SQL `notify_new_pending_order()` já existe (faz `net.http_post` para `notify-new-order` quando `status = 'pendente'`), **mas o trigger na tabela `orders` não está criado** (`db-triggers` = vazio). Por isso hoje nada dispara automaticamente.
- Push do navegador (Chrome/Android) é exatamente a "notificação do Google" que você descreveu.

## O que vai ser feito (somente Dicolore)

1. **Criar o trigger** que faltava em `public.orders` para chamar `notify_new_pending_order()` em `AFTER INSERT` e em `AFTER UPDATE OF status` quando o novo status virar `pendente`. O trigger é genérico, mas o filtro Dicolore fica dentro da Edge Function (passo 2).

2. **Ajustar `supabase/functions/notify-new-order/index.ts`:**
   - Carregar o `slug` da loja (já carrega) e o `status` do pedido (já carrega).
   - Se `slug === 'dicolore'` **e** `status === 'pendente'`:
     - `title`: `Novo pedido #277 — avaliar`
     - `body`: `Olá, a cliente "APARECIDA DE JESUS DANTAS DE MEDEIROS" enviou o pedido #00277 para a sua avaliação.`
     - `url`: `/dicolore/admin` (abre direto a tela de pedidos ao clicar)
     - `tag`: `dicolore-followup-<order.id>` (evita duplicar notificação do mesmo pedido)
   - Demais lojas continuam com o texto atual.
   - Número do pedido formatado com 5 dígitos (`#00277`).
   - Nome do cliente vem de `order.customer.name`; usar capitalização/trim básico.

3. **Sem mudança no fluxo de gravação de pedido** no `useCreateOrder`. O disparo passa a ser feito pelo trigger no banco, então funciona tanto pelo checkout do site quanto por pedidos injetados via `criar-pedido` (API externa) e por qualquer caminho que insira em `orders`.

4. **Pré-requisito do vendedor (sem código):** a Luciana (vendedor 4) precisa abrir `/dicolore/admin` no celular/desktop dela uma vez, fazer login com o usuário dela e clicar em "Ativar notificações" no card de Push Notifications (já existente, `PushNotificationsCard`). Isso cria a linha em `push_subscriptions` necessária para o Web Push chegar. Sem isso, o servidor envia mas o navegador dela não tem para onde entregar.

## Como testar com o pedido #277

- Reenviar manualmente (sem precisar de novo pedido) via `curl` em `notify-new-order` com `{ "order_id": "<id do pedido 277>" }`. Como o pedido 277 está pendente e é da Dicolore, a Luciana (se tiver push ativo) deve receber a notificação no formato novo.
- Depois do trigger ativo, qualquer novo pedido pendente da Dicolore dispara automaticamente.

## Detalhes técnicos

- Migration adicionando:
  ```sql
  drop trigger if exists trg_notify_new_pending_order on public.orders;
  create trigger trg_notify_new_pending_order
    after insert on public.orders
    for each row execute function public.notify_new_pending_order();

  drop trigger if exists trg_notify_status_pending on public.orders;
  create trigger trg_notify_status_pending
    after update of status on public.orders
    for each row
    when (new.status in ('pendente','pending') and old.status is distinct from new.status)
    execute function public.notify_new_pending_order();
  ```
- `notify-new-order/index.ts`: adicionar bloco `if ((store?.slug || '') === 'dicolore' && order.status === 'pendente')` que sobrescreve `title`/`body`/`tag` antes do `webpush.sendNotification`.
- Formatação: `#${String(order.order_number).padStart(5,'0')}`.
- Nada muda em RLS, secrets ou config.toml. VAPID já está configurado.

## Limitações honestas

- iPhone (Safari) só recebe Web Push se o usuário tiver instalado o site como PWA (Adicionar à Tela de Início) e permitido notificações — limitação do iOS, não do código.
- Se a notificação não chegar, na maioria das vezes é por: vendedor sem `push_subscriptions` ativo, cliente sem `seller_code` preenchido, ou navegador do vendedor com permissão negada. O painel já tem `PushNotificationsCard` e a aba de clientes mostra o vendedor vinculado para diagnóstico.
