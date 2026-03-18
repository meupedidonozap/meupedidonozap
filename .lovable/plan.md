

# Ferramenta de Análise de Visitas no Painel Admin

## Como funciona

Sim, é possível. A solução envolve duas partes:

1. **Registrar cada visita** quando um cliente acessa a página da loja
2. **Exibir os dados** no painel admin com gráficos e totais

## Plano de implementação

### 1. Migração: criar tabela `store_visits`

```sql
CREATE TABLE public.store_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  page text DEFAULT '/',
  user_agent text DEFAULT '',
  ip_hash text DEFAULT ''
);
```

- RLS: leitura apenas para store admins; inserção pública (anônima) para registrar visitas
- Índice em `(store_id, visited_at)` para queries eficientes

### 2. Hook `useStoreVisits.ts`

- **`useTrackVisit(storeId)`**: mutation chamada uma vez ao carregar a página da loja (StorePage), registra a visita
- **`useStoreVisits(storeId, dateRange)`**: query que retorna visitas agrupadas por dia e hora para o admin

### 3. Registrar visitas na StorePage

- Chamar `useTrackVisit` no `StorePage.tsx` com um `useEffect` que dispara uma vez por sessão (usando sessionStorage para evitar contagem duplicada por refresh)

### 4. Nova aba "Visitas" no StoreAdminPage

- Adicionar ícone `BarChart3` e aba "Visitas" no TabsList
- **Card de total**: mostra o total de visitas geral
- **Gráfico de barras por dia**: usando Recharts (já instalado), mostra visitas dos últimos 30 dias com filtro de data
- **Tabela de visitas por hora**: para o dia selecionado, mostra quantas visitas em cada faixa horária
- Filtro de período com calendário (já existe componente Calendar)

### Detalhe técnico

Para não inflar a tabela, cada visita gera apenas uma linha com timestamp. A agregação (por dia, hora) é feita via queries SQL com `date_trunc`. O `ip_hash` é um hash simples do user-agent para estimar visitantes únicos sem armazenar dados pessoais.

