## Objetivo

Permitir configurar **horário de funcionamento** por loja (vários turnos por dia + dias fechados). Cliente continua vendo o catálogo, mas:
- Ao abrir a loja, vê um **aviso de "Fechado agora"** com próximo horário.
- No **checkout**, o botão de envio é **bloqueado** quando fora do horário (toast/banner explicando).

## Modelo de dados (sem migração)

Aproveitar o JSONB `stores.settings` já existente, adicionando a chave:

```json
"businessHours": {
  "timezone": "America/Sao_Paulo",
  "days": {
    "0": { "closed": true,  "shifts": [] },                // domingo
    "1": { "closed": false, "shifts": [{"from":"08:00","to":"13:30"},{"from":"17:00","to":"22:00"}] },
    "2": { ... }, "3": {...}, "4": {...}, "5": {...}, "6": {...}
  },
  "closedDates": ["2026-12-25", "2026-01-01"]   // datas específicas fechadas
}
```

Default quando ausente: **sempre aberto** (preserva comportamento atual de todas as outras lojas).

## Mudanças de código

### 1) Admin — nova aba "Horários" em `src/pages/StoreAdminPage.tsx`
- Componente novo `src/components/BusinessHoursTab.tsx`:
  - Grade dos 7 dias com checkbox "Fechado" + lista de turnos (botão "Adicionar turno"; cada turno = inputs `time` from/to + remover).
  - Lista de "Dias fechados" (datas específicas) com botão adicionar/remover.
  - Botão **Salvar** → `supabase.from('stores').update({ settings: { ...settings, businessHours } }).eq('id', store.id)`.
- Adicionar `<TabsTrigger value="hours">Horários</TabsTrigger>` e o `<TabsContent>` correspondente.

### 2) Lógica reaproveitável — `src/lib/businessHours.ts`
- `isStoreOpen(settings, now = new Date()): { open: boolean; reason?: string; nextOpenLabel?: string }`
- Considera dia da semana, turnos, lista de `closedDates` (formato `YYYY-MM-DD` na timezone configurada).
- Quando `businessHours` não estiver definido → retorna `{ open: true }`.
- Calcula próximo horário de abertura (mesmo dia turno seguinte ou próximo dia útil) para exibir mensagem do tipo "Abre hoje às 17:00" / "Abre amanhã às 08:00".

### 3) Hook `src/hooks/useStoreOpen.ts`
- `useStoreOpen(store)` retorna `{ open, message }`, recalcula a cada 60s via `setInterval`.

### 4) Aviso na storefront
- Em `src/pages/FoodStorePage.tsx`, `src/pages/ProductStorePage.tsx`, `src/pages/PizzaStorePage.tsx`, `src/pages/SalonStorePage.tsx`, `src/pages/StorePage.tsx`:
  - Logo abaixo do header, se `!open`, renderizar um banner destacado (vermelho/aviso) com a mensagem e o próximo horário.
- Catálogo continua visível e navegável (sem bloqueio).

### 5) Bloqueio no checkout — `src/pages/CheckoutPage.tsx`
- Importar `useStoreOpen`.
- Se `!open`: mostrar banner fixo no topo do formulário + desabilitar o botão "Enviar pedido / WhatsApp" e exibir tooltip/toast "Loja fechada — pedidos só dentro do horário de funcionamento".
- Validação adicional na função submit (defesa em profundidade): se `!open`, `toast.error(...)` e `return`.

### 6) Sem mudanças em
- Banco de dados (schema/migrations) — apenas grava em `stores.settings`.
- Pedidos via mesa/garçom/admin manual (operação interna não é bloqueada).
- RLS, hooks de pedidos, edge functions.

## Arquivos a criar/editar

**Novos**
- `src/lib/businessHours.ts`
- `src/hooks/useStoreOpen.ts`
- `src/components/BusinessHoursTab.tsx`

**Editar**
- `src/pages/StoreAdminPage.tsx` (adicionar aba)
- `src/pages/FoodStorePage.tsx`, `ProductStorePage.tsx`, `PizzaStorePage.tsx`, `SalonStorePage.tsx`, `StorePage.tsx` (banner fechado)
- `src/pages/CheckoutPage.tsx` (bloqueio de envio)
