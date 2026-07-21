## Objetivo
Garantir que **todos os clientes** da DiColore tenham localização (`geo_lat`/`geo_lng`) vinculada ao endereço, corrigir o erro do Google Maps na aba Atendimento e permitir ajuste manual quando o endereço não for reconhecido.

## 1. Diagnóstico do erro "Esta página não carregou o Google Maps corretamente"

Essa mensagem é do próprio Google e aparece quando o script carrega mas alguma chamada falha (referrer bloqueado, API desabilitada, cota, etc.). No preview `id-preview--...lovable.app` a chave gerenciada costuma funcionar, mas o overlay some da tela útil.

Ações:
- Ler o console real do preview (`code--read_console_logs`) para identificar o código exato (`RefererNotAllowedMapError`, `ApiNotActivatedMapError`, `BillingNotEnabledMapError` etc.).
- Se for erro de chave/referrer da chave gerenciada em domínio custom: reportar ao usuário para conectar chave própria (Google Maps Platform connector custom).
- Ajustar `MiniMap` para renderizar um **fallback amigável** (endereço + botão "abrir no Google Maps" + botão "ajustar posição manualmente") em vez de deixar o overlay do Google cobrir tudo — capturar `authFailure` via `window.gm_authFailure` e trocar por UI própria.

## 2. Geocodificar TODOS os clientes existentes (backfill em massa)

Adicionar botão **"Localizar todos os clientes"** no header da aba Atendimento (visível para admin) que:
- Chama uma nova Edge Function `bulk-geocode-customers` (loop sobre `customer_profiles` da loja com `geo_lat is null` e endereço preenchido).
- Reutiliza a lógica atual do `geocode-address` (Google Maps via gateway) com throttling de ~10 req/s para respeitar cota.
- Retorna resumo: `{ total, ok, falhou, semEndereco }`.
- Marca clientes que falharam com uma flag lógica (não precisa coluna nova — o próprio `geo_lat is null` + endereço presente já indica pendência).

Progresso mostrado com toast + refetch ao final.

## 3. Aviso e correção manual por cliente

Na lista de clientes da aba Atendimento:
- Cada cliente sem `geo_lat/lng` recebe um selo laranja **"Localização pendente"**.
- Um contador no topo: *"X clientes sem localização"* com botão "Corrigir agora" que filtra a lista para mostrar só os pendentes.

Ao selecionar um cliente pendente (ou clicar em "Ajustar localização" num cliente já localizado):
- Abre um seletor manual: `MiniMap` com o pin arrastável centralizado na cidade/CEP do cliente (usa geocoding só do CEP/cidade como ponto inicial) + campo de busca do Google Places para digitar um endereço alternativo.
- Botão **"Confirmar este ponto como localização do cliente"** grava `geo_lat/geo_lng` em `customer_profiles`.

## 4. Detalhes técnicos

- **Edge Function nova**: `supabase/functions/bulk-geocode-customers/index.ts`
  - Autoriza via JWT do admin logado (checa `store_admins` / `platform_admins` para o `store_id`).
  - Processa em lotes; retorna estatísticas.
- **Frontend**:
  - `src/components/AtendimentoTab.tsx`: adicionar banner de pendentes, botão "Localizar todos", modo de ajuste manual.
  - Novo componente `src/components/CustomerLocationPicker.tsx`: mapa com marker arrastável + campo de busca.
  - `src/lib/geo.ts`: adicionar helper para pin arrastável e integração com `google.maps.places.AutocompleteSuggestion` (Places New via gateway browser key).
  - Tratar `gm_authFailure` para exibir mensagem clara e link para o admin conectar a própria chave (quando aplicável).
- **Sem mudanças de schema** (as colunas `geo_lat/geo_lng` já existem).

## 5. O que NÃO faz parte deste plano
- Não altera regras de check-in/raio de 300m.
- Não mexe em preços, produtos, categorias ou pedidos.
- Não cria coluna nova; usa `geo_lat is null` como indicador de pendência.

## Fluxo final para o usuário
1. Admin abre Atendimento → vê "X clientes sem localização" + botão **Localizar todos**.
2. Clica → função em lote geocodifica endereços via Google.
3. Clientes que ainda falharem aparecem com selo **Localização pendente**; admin abre o cliente, ajusta o pin no mapa manualmente e confirma.
4. Vendedor passa a ver 100% dos clientes com endereço vinculado ao mapa.
