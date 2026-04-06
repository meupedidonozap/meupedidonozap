

# Seleção de Vendedor no Checkout da Dicolore

## Resumo

Criar uma tabela `store_sellers` para cadastrar vendedores (nome + WhatsApp) vinculados à loja. No painel admin da Dicolore, uma seção para gerenciar vendedores. No checkout, se a loja tiver vendedores cadastrados, exibir um seletor para o cliente escolher para quem enviar o pedido via WhatsApp.

## Mudanças

### 1. Nova tabela `store_sellers` (migração)

```sql
CREATE TABLE public.store_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  name text NOT NULL,
  whatsapp text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_sellers ENABLE ROW LEVEL SECURITY;

-- Leitura pública (para o checkout)
CREATE POLICY "Public read active sellers" ON public.store_sellers
  FOR SELECT TO public USING (is_active = true);

-- Admin da loja gerencia
CREATE POLICY "Store admins manage sellers" ON public.store_sellers
  FOR ALL TO authenticated
  USING (is_store_admin(auth.uid(), store_id))
  WITH CHECK (is_store_admin(auth.uid(), store_id));
```

### 2. Hook `useStoreSellers` (novo arquivo)

**`src/hooks/useStoreSellers.ts`** — CRUD para vendedores de uma loja usando React Query.

### 3. Painel Admin — Aba/seção de Vendedores

**`src/pages/StoreAdminPage.tsx`** — Apenas para a loja Dicolore (verificando `store.slug === 'dicolore'`), adicionar uma seção na aba Configurações (ou sub-aba) para listar, adicionar, editar e remover vendedores (nome + WhatsApp).

### 4. Checkout — Seletor de vendedor

**`src/pages/CheckoutPage.tsx`**:
- Buscar vendedores ativos da loja via `useStoreSellers`
- Se houver vendedores cadastrados, exibir um `Select` ou lista de radio buttons na seção "Pagamento e Entrega" para o cliente escolher o vendedor
- O WhatsApp selecionado substitui `store.whatsapp` na chamada `openWhatsApp(selectedPhone, ...)`
- Se não houver vendedores, comportamento atual (envia para `store.whatsapp`)

### Fluxo

```text
Admin cadastra vendedores (nome + whatsapp)
         ↓
Cliente no checkout vê lista de vendedores
         ↓
Escolhe vendedor → pedido vai para o WhatsApp dele
         ↓
Se não há vendedores cadastrados → funciona como hoje (número fixo da loja)
```

### Escopo da Dicolore

A funcionalidade é genérica (qualquer loja pode ter vendedores), mas a seção no admin só aparece para `slug === 'dicolore'`. Futuramente pode ser liberada para todas.

