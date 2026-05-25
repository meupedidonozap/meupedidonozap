## Restringir aba "Código" ao Dicolore

No `CustomerAuthDialog.tsx`, a aba **Código** (login por código de cliente + senha) só deve aparecer quando a loja for a Dicolore (`storeSlug === 'dicolore'`). Nas demais lojas o diálogo mostra apenas **Entrar** e **Cadastrar**.

### Mudanças
- `src/components/CustomerAuthDialog.tsx`:
  - Calcular `showCodeTab = storeSlug === 'dicolore'`.
  - Em `TabsList`: renderizar `<TabsTrigger value="code">` apenas se `showCodeTab` (e ajustar `grid-cols-3` → `grid-cols-2` quando oculto).
  - Estado inicial `authTab`: usar `'code'` se `showCodeTab`, senão `'login'`.
  - Renderizar o `<TabsContent value="code">` somente se `showCodeTab`.
  - Garantir que ao abrir o diálogo o tab default respeite a mesma regra.

Sem mudanças de backend, RLS ou no fluxo de outras lojas.