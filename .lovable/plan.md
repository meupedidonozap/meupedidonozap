
## Objetivo

Quando um pedido cair com status `pendente`, disparar uma notificação push (estilo Google) no navegador/celular do **vendedor titular do cliente** e dos **televendas vinculados** a esse vendedor.

A entrega usa Web Push padrão (VAPID), funciona como notificação nativa do sistema operacional (Android, Windows, macOS, Linux). No iOS funciona se o painel for instalado como PWA na tela inicial (iOS 16.4+).

---

## Como vai funcionar (fluxo)

```text
Cliente faz pedido (status=pendente)
        │
        ▼
Trigger Postgres AFTER INSERT em public.orders
        │  (chama via pg_net a edge function notify-new-order)
        ▼
Edge Function notify-new-order
        │  1. Lê seller_code do cliente do pedido
        │  2. Usa get_order_recipients() já existente para achar
        │     vendedor + televendas (store_sellers.id)
        │  3. Busca push_subscriptions ativas desses sellers
        │  4. Envia Web Push (VAPID) para cada subscription
        ▼
Service Worker do painel mostra notificação
"Novo pedido #1234 — Cliente X — R$ 250,00"  → ao clicar abre /:slug/admin
```

---

## O que precisa ser construído

### 1. Banco (migration)

- Tabela `push_subscriptions`:
  - `id uuid pk`, `store_id uuid`, `seller_id uuid` (FK lógica para `store_sellers.id`), `user_id uuid` (auth, opcional), `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `is_active bool`, `created_at`, `last_used_at`.
  - GRANTs + RLS: o próprio vendedor/televendas logado pode inserir/desativar a sua subscription; admin da loja pode ler todas da loja; service_role acessa via Edge Function.
- Trigger `AFTER INSERT ON public.orders WHEN (NEW.status IN ('pendente','pending'))`:
  - Função `plpgsql` que usa `pg_net.http_post` para chamar `…/functions/v1/notify-new-order` com `{ order_id }` e o `anon key` no header.
- Habilitar extensões `pg_net` (já costumam estar) — verificar no migration.

### 2. Edge Function `notify-new-order` (pública, sem JWT)

- Recebe `{ order_id }`.
- Usa `SERVICE_ROLE_KEY` para:
  - Carregar o pedido (store_id, customer, total, order_number).
  - Ler `seller_code` do `customer_profiles` correspondente (match por `user_id` ou pelos últimos 8 dígitos do whatsapp do `customer` JSONB, mesmo padrão já usado em `useCustomerProfile`).
  - Chamar `public.get_order_recipients(store_id, seller_code)` → lista de sellers (vendedor + televendas).
  - Buscar `push_subscriptions` ativas com `seller_id IN (...)`.
- Para cada subscription, envia Web Push assinado com VAPID (lib `npm:web-push@3`).
  - Em caso de `404/410`, marca a subscription como inativa.
- Payload da notificação:
  - `title`: "Novo pedido #1234 — REVISAR"
  - `body`: "Cliente: Fulano · R$ 250,00"
  - `url`: `/<slug>/admin?tab=pedidos&order=<id>` (para abrir direto ao clicar).

### 3. Service Worker + frontend

- Criar `public/sw.js` com handlers `push` (mostra `self.registration.showNotification`) e `notificationclick` (foca/abre a `data.url`).
- Em `src/main.tsx` registrar o SW só em produção.
- Novo hook `useEnablePushNotifications()` chamado no painel `/:slug/admin`:
  - Detecta usuário logado, descobre o `seller_id` correspondente (via `store_users.seller_id` quando role=`vendedor` ou `televendas`; ou casa pelo `name`/`seller_codes` igual ao já feito em `get_order_recipients`).
  - Mostra botão "Ativar notificações de pedidos" → `Notification.requestPermission()` → `pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC })` → grava em `push_subscriptions`.
  - Reusa subscription existente; permite desativar.
- Banner discreto no topo do admin quando ainda não há permissão, para vendedores/televendas.

### 4. Configuração / segredos

- Gerar par VAPID (uma única vez).
- Guardar como secrets do Lovable Cloud:
  - `VAPID_PUBLIC_KEY` (público, também exposto no frontend via `import.meta.env` se preferir; pode estar hardcoded — é público por definição).
  - `VAPID_PRIVATE_KEY` (privado, só edge function).
  - `VAPID_SUBJECT` (`mailto:contato@meupedidonozap.com.br`).

### 5. Sem mensagens duplicadas

- O trigger só dispara em INSERT com status pendente.
- Se o pedido vier de `criar-pedido` (origem=whatsapp), também notifica (é o caso desejado).
- Edge function é idempotente por `order_id` + `subscription.endpoint` (sem registro de envio por enquanto; basta um `try/catch` por destino).

---

## Detalhes técnicos

- **Web Push**: padrão W3C, sem custo, sem Firebase. Usaremos `web-push` (Deno: `npm:web-push@3.6.7`) ou implementação manual com `crypto.subtle` se a lib der atrito no Deno.
- **iOS**: funciona apenas com o painel adicionado à tela inicial como PWA. Vou incluir um `manifest.webmanifest` mínimo + ícone para habilitar instalação.
- **Identificação do seller logado**:
  - Se `store_users.role IN ('vendedor','televendas')` e `seller_id` preenchido → usa direto.
  - Senão, tenta casar `store_users.name` ↔ `store_sellers.name` (mesma lógica de `get_order_recipients`).
  - Se nada bater, banner mostra "Vincule seu usuário a um vendedor para receber avisos" (admin precisa configurar em StoreUsersTab).
- **Telefone do vendedor para fallback WhatsApp**: fica registrado mesmo sem uso agora; se quiser ativar fallback wa.me no futuro, é trivial.

---

## Entregáveis

1. Migration: tabela `push_subscriptions` + RLS/GRANTs + trigger em `orders`.
2. Edge Function `supabase/functions/notify-new-order/index.ts`.
3. `public/sw.js` + registro em `src/main.tsx`.
4. Hook `src/hooks/usePushNotifications.ts`.
5. Botão/banner "Ativar notificações" em `StoreAdminPage` (ou aba dedicada) visível para vendedor/televendas.
6. Secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

---

## Pendências para confirmar antes de implementar

- **Tom da notificação**: "Novo pedido #1234 — REVISAR · Cliente Fulano · R$ 250,00 · 12:34". Posso ajustar.
- **Clique abre**: `/<slug>/admin` filtrado em "Pedidos pendentes". Confirma?
- **Iniciar pelos VAPID keys agora**: posso pedir os 3 secrets na fase de build.
