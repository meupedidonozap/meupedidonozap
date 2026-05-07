## Objetivo

Para o ramo SALÃO DE BELEZA: usar a aba **Produtos** existente como catálogo de serviços (incluindo tempo de execução para a agenda) e permitir que cada salão configure sua própria paleta de cores no storefront.

---

## 1. Produtos como Serviços (com duração)

### Banco de dados
- Adicionar coluna `duration_minutes` (integer, default 30) na tabela `products`. Usada apenas quando a loja é SALAO; ignorada nas demais.

### Cadastro/Edição de Produto (`ProductFormDialog`)
- Quando `store.type === 'SALAO'`:
  - Mostrar campo **"Tempo de execução (minutos)"** (obrigatório, mínimo 5).
  - Mostrar campo **"Profissionais que realizam"** (multi-select dos `salon_professionals` ativos).
  - Renomear rótulos visíveis: "Produto" → "Serviço", "Categoria" → "Tipo de serviço".
  - Esconder campos não aplicáveis: variantes, código (manter automático), grupo.
- Ao salvar: persistir `duration_minutes` no produto e sincronizar a tabela de vínculo `salon_service_professionals` usando `product.id` como `service_id` (a tabela já existe e funciona com qualquer UUID).

### Storefront SALAO (`SalonStorePage`)
- Trocar fonte de dados: ler de `useProducts(storeId)` em vez de `useSalonServices`.
- Mapear cada produto ativo como serviço: `name`, `description`, `base_price` (preço), `image_url`, `duration_minutes`, e profissionais via `salon_service_professionals`.
- Manter ordenação A-Z e fluxo de agendamento já implementado (Serviço → Profissional → Data → Horário).

### Admin
- Na aba **Salão**: remover sub-aba "Serviços" (vai para Produtos). Manter sub-abas **Profissionais** e **Agenda**.
- Manter `salon_services` no banco (não remover por compatibilidade), mas o app deixa de usá-la para SALAO.

---

## 2. Tema visual configurável por loja

### Configuração
- Adicionar em **Configurações da loja** (StoreAdminPage > Configurações) um seletor **"Tema do storefront"** com 4 presets:
  - **Masculino** (azul-marinho + dourado) — para barbearias
  - **Feminino** (rosa + rosé) — atual
  - **Neutro/Premium** (preto + dourado)
  - **Cor personalizada** (color picker para `--primary`)
- Salvar em `stores.settings.theme = { preset, primaryHsl?, accentHsl? }`.

### Aplicação
- `SalonStorePage` lê `store.settings.theme` e injeta variáveis CSS (`--salon-primary`, `--salon-primary-foreground`, gradiente do header) via `style={{...}}` no container raiz.
- Substituir todas as classes hardcoded `bg-pink-600`, `from-pink-500 to-rose-600`, `text-pink-600` por classes que usam essas CSS vars (ex: `bg-[hsl(var(--salon-primary))]`).
- Fallback: se não configurado, usar preset Masculino (mais neutro como default para um app de "salão" genérico).

---

## 3. Fora de escopo

- Não migrar dados antigos da tabela `salon_services` (vazia ou descartável — usuário só cadastrou pelo Produtos).
- Não mexer em LOJA/COMIDA/SERVICOS/PIZZARIA/ACESSORIOS.
- Notificações, pagamento online e bloqueio de feriados continuam fora.

---

## Arquivos afetados

- Migration: `ALTER TABLE products ADD COLUMN duration_minutes int NOT NULL DEFAULT 30;`
- `src/types/index.ts` — adicionar `durationMinutes` em Product e `theme` em StoreSettings.
- `src/hooks/useProducts.ts` — mapear novo campo.
- `src/components/ProductFormDialog.tsx` — campos condicionais para SALAO (duração + profissionais).
- `src/components/SalonAdminTab.tsx` — remover sub-aba Serviços.
- `src/pages/SalonStorePage.tsx` — usar Products como fonte; aplicar tema.
- `src/pages/StoreAdminPage.tsx` (aba Configurações) — seletor de tema.