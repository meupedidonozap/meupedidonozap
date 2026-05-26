
Esse plano cobre **apenas os itens 4 e 5** (que precisam de código). Itens 1, 2 e 3 foram respondidos na análise acima. Se quiser que eu rode auditoria de segurança formal (item 3) ou implemente alguma melhoria do item 2, peça em chat separado.

---

## Parte A — Template DELIVERY (item 4)

**Objetivo:** ao criar nova loja com tipo `COMIDA` no `AdminPage`, aplicar automaticamente a mesma configuração madura da Pastelaria RM26: regras de desconto, formas de pagamento, horários múltiplos (manhã/almoço/tarde/noite), material de apoio (ingredientes/molhos/bebidas comuns), categorias-base, métodos de impressão, frete, mesas exemplo.

### A.1 — Captura da config da Pastelaria RM26
1. Ler `stores.settings` da Pastelaria RM26 do banco (via `read_query`)
2. Ler `categories`, `ingredients`, `restaurant_tables` da Pastelaria RM26
3. Extrair tudo que é "configuração estrutural do ramo" (não dados específicos: sem produtos, sem clientes, sem pedidos, sem CNPJ, sem logo, sem endereço)

### A.2 — Arquivo de template
Criar `src/lib/storeTemplates.ts` com:
- `DELIVERY_TEMPLATE.settings` — JSON com horários (incluindo intervalo de almoço), regras de desconto progressivas, formas de pagamento (Pix/Cartão/Dinheiro), shipping padrão, materialApoio
- `DELIVERY_TEMPLATE.categories` — array de nomes (ex: "Salgados", "Bebidas", "Sobremesas", "Combos")
- `DELIVERY_TEMPLATE.ingredients` — ingredientes/molhos comuns (catchup, mostarda, maionese, etc.)
- `DELIVERY_TEMPLATE.tables` — opcional (algumas pastelarias têm balcão), 4 mesas exemplo desativadas

### A.3 — Aplicação no fluxo de criação
Em `src/pages/AdminPage.tsx`:
- Quando `type === 'COMIDA'` no submit do CreateDialog, em vez de `defaultSettings`, mesclar `DELIVERY_TEMPLATE.settings`
- Após `useCreateStore` retornar o `id`, executar em sequência:
  - `insert` em `categories` para cada categoria do template (com `store_id` novo)
  - `insert` em `ingredients` para cada ingrediente do template
  - `insert` em `restaurant_tables` para mesas exemplo (is_active=false)
- Toast: "Loja criada com modelo Delivery (Pastelaria) — X categorias e Y ingredientes pré-configurados"

### A.4 — UI no dialog
- Quando usuário seleciona "Delivery de Comida", mostrar badge azul:
  _"✓ Modelo Pastelaria será aplicado: horários com almoço, regras de desconto, formas de pagamento, categorias base e ingredientes comuns"_

### A.5 — Aplicar a outros tipos no futuro (extensível)
- Estrutura suporta adicionar `PIZZARIA_TEMPLATE`, `SALON_TEMPLATE` depois sem refatorar

**Arquivos:** criar `src/lib/storeTemplates.ts`, editar `src/pages/AdminPage.tsx`.
**DB:** sem migrações (só inserts via cliente, RLS já permite porque platform_admin cria).

---

## Parte B — Pacote SEO completo (item 5)

### B.1 — Sitemap.xml dinâmico
Criar `scripts/generate-sitemap.cjs` (modelo do prerender.cjs):
- Busca todas as lojas ativas via REST
- Busca produtos ativos por loja (para sitemap profundo)
- Gera `dist/sitemap.xml` com:
  - `/` (homepage)
  - `/{slug}` (cada loja, `priority=0.9`, `changefreq=daily`)
  - `/{slug}` para cada produto público? (opcional — depende se produto tem URL própria; verificar)
- `lastmod` = `updated_at` real da loja
- Atualizar `netlify.toml`: `command = "bun run build && node scripts/prerender.cjs && node scripts/generate-sitemap.cjs"`
- Adicionar `Sitemap: https://meupedidonozap.online/sitemap.xml` no final do `public/robots.txt`

### B.2 — JSON-LD por tipo de loja
Em `src/pages/StorePage.tsx` (ou em cada storefront), adicionar via `<Helmet>`:
- **COMIDA/PIZZARIA** → `@type: Restaurant` com `servesCuisine`, `priceRange`, `address`, `telephone`, `menu`, `openingHoursSpecification` (vindo de businessHours)
- **SALAO** → `@type: HealthAndBeautyBusiness`
- **LOJA/ACESSORIOS** → `@type: Store`
- **SERVICOS** → `@type: LocalBusiness`
- Todos com `aggregateRating` placeholder removível e `image: logo || banner`

Bonus: `BreadcrumbList` em rotas profundas.

### B.3 — index.html melhorado
- Title: `"MeuPedidoNoZap — Cardápio digital e pedidos por WhatsApp sem comissão"`
- Description: 155 chars com palavras-chave ("cardápio online", "pedido WhatsApp", "delivery sem comissão")
- JSON-LD `Organization` + `WebSite` com `SearchAction`

### B.4 — Noindex em rotas privadas
Adicionar `<Helmet><meta name="robots" content="noindex,nofollow"/></Helmet>` em:
- `CheckoutPage`, `OrderHistoryPage`, `StoreAdminPage`, `AdminPage`, `KitchenPage`, `WaiterPage`, `ResetPasswordPage`

### B.5 — Alt text e H1
- Auditar `ProductStorePage`, `FoodStorePage`, `PizzaStorePage`, `SalonStorePage`:
  - Garantir 1 `<h1>` por página = nome da loja
  - Todas `<img>` de produto com `alt={produto.name}`
  - Logo com `alt={`Logo ${store.name}`}`

### B.6 — Google Search Console — orientação operacional
Crio script (não-código) com passo-a-passo para você:

1. **Verificar domínio** em https://search.google.com/search-console
   - Adicionar propriedade `https://meupedidonozap.online`
   - Método: **Meta tag HTML** → Google fornece string `<meta name="google-site-verification" content="XXXX"/>`
   - Você cola em `index.html` (já tem 2 lá, basta adicionar/atualizar)
   - Clica "Verificar"

2. **Submeter sitemap:** Search Console → Sitemaps → colar `sitemap.xml` → Enviar

3. **Solicitar indexação manual** das principais lojas:
   - URL Inspection → cola `https://meupedidonozap.online/pastelariarm26` → "Solicitar indexação"
   - Repete para cada loja-vitrine

4. **Performance contínua:**
   - Acompanhar "Cobertura" semanalmente
   - Páginas com erro: corrigir e re-submeter
   - "Consultas" mostra palavras-chave que trazem visitas (alimenta futuras campanhas Google Ads)

5. **Para campanhas Google Ads:**
   - Páginas indexadas = elegíveis para Quality Score alto
   - Usar URLs de loja específicas como landing page
   - Conectar Search Console ao Google Ads para ver termos de busca reais

6. **Bing Webmaster Tools** (5% do tráfego BR): importar da Search Console em 1 clique

### B.7 — (Opcional) Sitemap automático no Search Console via API
Posso usar o conector Google Search Console para verificar domínio + submeter sitemap programaticamente. Requer aprovação OAuth no painel Connectors antes.

**Arquivos:** criar `scripts/generate-sitemap.cjs`, editar `netlify.toml`, `public/robots.txt`, `index.html`, `src/pages/StorePage.tsx` (e/ou cada storefront), `src/pages/CheckoutPage.tsx`, `OrderHistoryPage.tsx`, `StoreAdminPage.tsx`, `AdminPage.tsx`, `KitchenPage.tsx`, `WaiterPage.tsx`, `ResetPasswordPage.tsx`.
**DB:** nenhuma alteração.

---

## Resumo de impacto
- **Item 4** acelera onboarding de novas pastelarias/delivery em ~30 min de config manual
- **Item 5** torna lojas indexáveis no Google, permite Ads bem ranqueados e gera rich snippets (estrela, preço, horário direto na busca)
- Nenhuma quebra de funcionalidade existente
- Zero migração de DB

Após aprovação, implemento tudo numa única rodada. Se preferir dividir (ex: só item 4 primeiro), me avise.
