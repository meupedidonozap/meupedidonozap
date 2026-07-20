## Contexto

Na loja **DICOLORE**, adicionar:

1. Exibir o nome do usuário logado no cabeçalho do painel administrativo.
2. Nova aba **Atendimento** — visível para vendedores (usuários com `seller_codes` em `store_users`, sem permissões de admin). Admin/platform_admin não fará checkin , mas verá a aba,  e poderá ver os clientes que tiveram ou não checkin realizado, podendo exportar os dados de cliente com ou sem checkin.
3. Vendedor vê apenas seus clientes (filtro por `seller_code`), com endereço e mini-mapa Google Maps.
4. Botão **Check-in** habilitado só quando a geolocalização do vendedor está a ≤ 300 m do endereço do cliente. **Check-out** ao sair.
5. Registrar `checked_in_at`, `checked_out_at`, `checkin_lat/lng`, `checkout_lat/lng`.

## Passos

**1. Banco de dados**
Criar tabela `public.customer_visits`:

- `id`, `store_id`, `seller_user_id` (auth), `seller_code`, `customer_profile_id`
- `checked_in_at`, `checked_out_at` (timestamptz)
- `checkin_lat`, `checkin_lng`, `checkout_lat`, `checkout_lng` (numeric)
- `distance_meters_at_checkin` (numeric)
- `created_at`, `updated_at`
- RLS: vendedor lê/insere/atualiza apenas suas próprias visitas; admin da loja lê todas.
- GRANTs para `authenticated` e `service_role`. Trigger `update_updated_at`.

**2. Conector Google Maps**
Confirmar/vincular a conexão gerenciada do Google Maps Platform ao projeto (para geocoding via gateway e Maps JS API no browser via `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`).

**3. Edge Function `geocode-address**`
Recebe `{ address }`, chama `/maps/api/geocode/json` via connector gateway, retorna `{ lat, lng }`. Guarda o resultado em uma coluna nova em `customer_profiles` (`geo_lat`, `geo_lng`) para não geocodificar toda vez — migration adiciona essas colunas (nullable).

**4. Header do painel — usuário logado**
Em `StoreAdminPage.tsx`: mostrar email/nome do `user` do `useAuth` ao lado do botão "Sair" (substituir o campo em branco visível no print).

**5. Aba Atendimento (vendedor)**

- Novo componente `AtendimentoTab.tsx` renderizado como aba adicional em `StoreAdminPage` quando `isStoreUser && sellerCodes.length > 0 && !isAdmin`.
- Nesse caso, ocultar as demais abas administrativas e mostrar apenas **Atendimento** (vendedor não é admin operacional).
- Lista clientes de `customer_profiles` filtrando `store_id` e `seller_code IN (sellerCodes)`, ordem alfabética.
- Cada card mostra: nome, endereço completo, WhatsApp, botão "Ver mapa" que expande um `<div>` com Maps JS (`google.maps.Map` + `Marker`, sem `mapId`, `loading=async`, callback global).
- Botão **Check-in**: pede `navigator.geolocation.getCurrentPosition`, calcula distância (Haversine) até `geo_lat/lng` do cliente. Se ≤ 300 m insere `customer_visits` com `checked_in_at=now()`. Caso contrário: toast informando distância atual.
- Se já existe visita aberta (sem `checked_out_at`), mostra botão **Check-out** que atualiza `checked_out_at` e coords.
- Histórico do dia visível abaixo da lista.

**6. Restrição de acesso**

- Aba Atendimento só aparece para vendedores (`isStoreUser && sellerCodes.length > 0`).
- `useStoreAdmin.hasAccess` precisa aceitar vendedor com `seller_codes` mesmo sem outras permissões — ajuste mínimo para permitir entrar no painel apenas para ver Atendimento.

**7. Restrito à DICOLORE**

- Renderização condicional da aba: só quando `store.slug === 'dicolore'`.

## Detalhes técnicos

- Distância Haversine em `src/lib/geo.ts`.
- Geocoding lazy: quando o vendedor abre o card do cliente e `geo_lat` está nulo, chama a edge function e salva.
- Maps JS carregado uma única vez via `useEffect` global; `channel` = `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID`.
- Timeout de geolocalização 15 s, `enableHighAccuracy: true`.
- Realtime não necessário nesta versão.

## Fora de escopo

- Rotas otimizadas, notas de visita, resultado da venda (usuário optou apenas por GPS + data/hora).
- Não altera nada nas demais lojas.