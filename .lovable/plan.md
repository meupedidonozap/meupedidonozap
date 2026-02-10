
# Plano: Conectar com Lovable Cloud + Cadastro de Produtos

## Resumo
Vamos conectar o projeto ao Lovable Cloud (Supabase) para persistir dados de lojas, produtos e pedidos. Tambem vamos implementar o CRUD completo de produtos no painel admin de cada loja, com upload de imagem, edicao de descricao/preco e toggle ativo/inativo.

---

## Etapa 1: Ativar Lovable Cloud e Criar o Banco de Dados

Criar as seguintes tabelas via migracao SQL:

### Tabela `stores`
| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador unico |
| slug | text (unique) | URL da loja |
| name | text | Nome da loja |
| type | text | LOJA, ACESSORIOS ou COMIDA |
| logo | text | URL do logo |
| banner | text | URL do banner |
| address | text | Endereco |
| phone | text | Telefone |
| whatsapp | text | WhatsApp |
| email | text | Email |
| is_active | boolean | Status |
| settings | jsonb | Configuracoes (cores, taxas, horarios, regras) |
| created_at | timestamptz | Data de criacao |

### Tabela `categories`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| store_id | uuid (FK -> stores) |
| name | text |
| sort_order | integer |

### Tabela `products`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| store_id | uuid (FK -> stores) |
| code | text |
| name | text |
| description | text |
| category_id | uuid (FK -> categories) |
| group_id | text (nullable) |
| base_price | numeric |
| image_url | text (nullable) |
| is_active | boolean |
| has_variants | boolean |
| created_at | timestamptz |

### Tabela `product_variants`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| product_id | uuid (FK -> products) |
| color | text (nullable) |
| size | text (nullable) |
| price | numeric |
| stock | integer |
| sku | text |

### Tabela `food_items`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| store_id | uuid (FK -> stores) |
| name | text |
| description | text |
| category_id | uuid (FK -> categories) |
| price | numeric |
| image_url | text (nullable) |
| is_active | boolean |
| preparation_time | integer |

### Tabela `orders`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| store_id | uuid (FK -> stores) |
| order_number | serial |
| customer | jsonb |
| items | jsonb |
| subtotal | numeric |
| discount | numeric |
| delivery_fee | numeric |
| total | numeric |
| payment_method | text |
| delivery_shift | text |
| observations | text (nullable) |
| status | text |
| created_at | timestamptz |

### Tabela `coupons`
| Coluna | Tipo |
|--------|------|
| id | uuid (PK) |
| store_id | uuid (FK -> stores) |
| code | text |
| discount_percent | numeric (nullable) |
| discount_value | numeric (nullable) |
| min_order_value | numeric |
| max_uses | integer |
| used_count | integer |
| expires_at | timestamptz |
| is_active | boolean |

### Storage Bucket
- Criar bucket `product-images` (publico) para upload de imagens de produtos.

### RLS (Row Level Security)
- Todas as tabelas com RLS habilitado.
- SELECT publico em: `stores`, `categories`, `products`, `product_variants`, `food_items`.
- INSERT/UPDATE/DELETE aberto para todas as tabelas (sem autenticacao por enquanto -- sera adicionada depois).
- SELECT publico tambem em `orders` e `coupons` (temporariamente, ate implementar auth).

---

## Etapa 2: Camada de Dados (Hooks e Servicos)

Criar hooks React Query para substituir os dados mock:

- `src/hooks/useStores.ts` - listar/buscar lojas
- `src/hooks/useCategories.ts` - categorias por loja
- `src/hooks/useProducts.ts` - CRUD de produtos por loja (incluindo variantes)
- `src/hooks/useFoodItems.ts` - itens de comida por loja
- `src/hooks/useOrders.ts` - pedidos por loja
- `src/hooks/useCoupons.ts` - cupons por loja

Cada hook usara `@tanstack/react-query` com `useQuery` para leitura e `useMutation` para escrita.

---

## Etapa 3: Upload de Imagem de Produto

- Funcao utilitaria para fazer upload de imagem ao bucket `product-images` do Supabase Storage.
- No formulario de produto, um campo de upload com preview da imagem.
- Ao salvar, faz upload da imagem e armazena apenas a URL publica no campo `image_url` do produto.

---

## Etapa 4: Formulario de Cadastro/Edicao de Produto

Criar um componente `ProductFormDialog` com:

- Campo de **imagem** (upload com preview)
- Campo **codigo** (texto)
- Campo **nome** (texto)
- Campo **descricao** (textarea)
- Campo **categoria** (select das categorias da loja)
- Campo **preco base** (numerico)
- Toggle **ativo/inativo** (switch)
- Toggle **possui variantes** (switch)
- Se possuir variantes: sub-formulario para adicionar cor, tamanho, preco, estoque, SKU

Acoes:
- Botao "Novo Produto" abre o dialog vazio
- Botao "Editar" (icone lapis) na tabela abre o dialog preenchido
- Botao "Excluir" remove o produto (com confirmacao)
- Toggle de status na tabela altera ativo/inativo diretamente

---

## Etapa 5: Atualizar Paginas Existentes

Atualizar as paginas para usar dados do Supabase em vez de mock:

1. **HomePage** (`/`) - listar lojas do banco
2. **AdminPage** (`/admin`) - CRUD de lojas no banco
3. **StoreAdminPage** (`/:slug/admin`) - aba Produtos com formulario completo
4. **ProductStorePage** (`/:slug`) - listar produtos do banco
5. **FoodStorePage** - listar food items do banco
6. **CheckoutPage** - salvar pedido no banco
7. **StorePage** - buscar loja por slug no banco

---

## Etapa 6: Seed de Dados Iniciais

Inserir os dados mock existentes (lojas DiColore, GuabaCity, ModaFashion e seus produtos) no banco de dados para manter o prototipo funcional.

---

## Detalhes Tecnicos

- **Supabase Client**: Sera configurado automaticamente pelo Lovable Cloud
- **React Query**: Ja instalado, sera usado para cache e sincronizacao
- **Upload de imagem**: Supabase Storage com bucket publico, sem base64 no banco
- **Validacao**: Zod para validacao dos formularios de produto
- **Tipos**: Os tipos em `src/types/index.ts` serao ajustados para refletir o schema do banco (campos snake_case)
