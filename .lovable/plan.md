

# Novo Tipo de Loja: SERVICOS + Ordem de Servico (OS) + Gestao de Clientes

## Resumo

Adicionar o tipo de loja "SERVICOS" com vitrine similar a LOJA, e um fluxo de Ordem de Servico (OS) no painel admin, onde pedidos podem ser transformados em OS com itens adicionais. Tambem adicionar uma aba "Clientes" no painel admin de cada loja para visualizar/editar cadastros.

---

## 1. Banco de Dados

### 1.1 Alterar coluna `type` da tabela `stores`
Ja aceita texto livre, entao basta usar o valor `'SERVICOS'` -- nenhuma migracao de schema necessaria.

### 1.2 Nova tabela `service_orders`

```
service_orders
  id          uuid PK default gen_random_uuid()
  store_id    uuid NOT NULL
  order_id    uuid (FK para orders, nullable - pode ser criada sem pedido original)
  customer    jsonb NOT NULL (mesmo formato do orders)
  items       jsonb NOT NULL (itens originais do pedido)
  extra_items jsonb NOT NULL default '[]' (itens adicionados pelo admin)
  subtotal    numeric NOT NULL default 0
  discount    numeric NOT NULL default 0
  total       numeric NOT NULL default 0
  status      text NOT NULL default 'aberta' (aberta, em_andamento, concluida, cancelada)
  observations text
  created_at  timestamptz default now()
  updated_at  timestamptz default now()
  user_id     uuid (cliente)
```

**RLS**: Leitura/escrita restrita a store admins. Clientes podem ler suas proprias OS.

### 1.3 Trigger `updated_at`
Reutilizar a funcao `update_updated_at_column()` existente.

---

## 2. Frontend - Tipo SERVICOS

### 2.1 `src/types/index.ts`
- Adicionar `'SERVICOS'` ao tipo `StoreType`

### 2.2 `src/pages/AdminPage.tsx`
- Adicionar opcao "Servicos" no Select de tipo de loja
- Adicionar label e cor de badge para SERVICOS

### 2.3 `src/pages/StorePage.tsx`
- Para `type === 'SERVICOS'`, renderizar `ProductStorePage` (mesmo componente, pois usa o mesmo layout)

---

## 3. Ordem de Servico (OS) no Painel Admin

### 3.1 Novo hook `src/hooks/useServiceOrders.ts`
- `useServiceOrders(storeId)` - listar OS da loja
- `useCreateServiceOrder()` - criar OS a partir de um pedido
- `useUpdateServiceOrder()` - atualizar OS (adicionar itens, mudar status)

### 3.2 Nova aba "Ordens de Servico" no `StoreAdminPage.tsx`
Visivel apenas para lojas do tipo SERVICOS. Contera:
- Lista de OS com numero, cliente, total, status e data
- Ao clicar em uma OS, abre dialog de edicao

### 3.3 Botao "Gerar OS" na aba de Pedidos
Quando a loja e do tipo SERVICOS, cada pedido tera um botao "Gerar OS" que:
1. Cria um registro em `service_orders` com os dados do pedido
2. Abre o dialog de edicao da OS

### 3.4 Dialog de edicao da OS (`ServiceOrderDialog.tsx`)
Permite ao admin:
- Ver itens originais do pedido
- **Adicionar itens do catalogo**: busca no catalogo da loja e seleciona
- **Adicionar itens avulsos**: digita nome, descricao e valor manualmente
- Remover itens extras
- Ver total atualizado automaticamente
- Alterar status (Aberta -> Em Andamento -> Concluida / Cancelada)
- Botao "Enviar OS por WhatsApp" que formata e envia a OS completa

### 3.5 Formato da mensagem WhatsApp da OS
```
ORDEM DE SERVICO #123
Loja: Rafas Marido de Aluguel
Cliente: FULANO
WhatsApp: (47) 99999-9999

SERVICOS:
1x Descontar e Montar Guarda Roupa - R$ 150,00

MATERIAIS ADICIONAIS:
1x Corredica Telescopica Light 25cm - R$ 45,00

Subtotal: R$ 195,00
Total: R$ 195,00

Status: Em Andamento
```

---

## 4. Gestao de Clientes no Painel Admin

### 4.1 Nova aba "Clientes" no `StoreAdminPage.tsx`
- Lista todos os `customer_profiles` vinculados aquela loja
- Mostra nome, WhatsApp, cidade/UF
- Botao para editar dados do cliente (nome, whatsapp, endereco)
- A RLS ja permite que store admins leiam os perfis (`is_store_admin`)

### 4.2 Permissao de UPDATE para store admins
Adicionar politica RLS na tabela `customer_profiles`:
```sql
CREATE POLICY "Store admins can update customer profiles"
  ON customer_profiles FOR UPDATE
  USING (is_store_admin(auth.uid(), store_id));
```

---

## 5. Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabela `service_orders` + RLS + politica update em customer_profiles |
| `src/types/index.ts` | Adicionar SERVICOS ao StoreType + tipos ServiceOrder |
| `src/pages/AdminPage.tsx` | Adicionar opcao SERVICOS no select + label/badge |
| `src/pages/StorePage.tsx` | Tratar tipo SERVICOS (usa ProductStorePage) |
| `src/hooks/useServiceOrders.ts` | CRUD de ordens de servico |
| `src/components/ServiceOrderDialog.tsx` | Dialog para editar OS e adicionar itens |
| `src/pages/StoreAdminPage.tsx` | Aba "OS" + aba "Clientes" + botao "Gerar OS" nos pedidos |

---

## 6. O que NAO muda

- O fluxo de compra do cliente continua igual (vitrine -> carrinho -> login -> checkout -> WhatsApp)
- O cadastro do cliente ja funciona em 2 etapas (credenciais + perfil completo)
- Lojas tipo LOJA e COMIDA nao sao afetadas
- A aba de OS so aparece para lojas SERVICOS

