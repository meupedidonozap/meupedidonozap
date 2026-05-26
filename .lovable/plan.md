## Controle de Licença por Data

### 1. Banco de dados (migration)
- Adicionar coluna `license_expires_at DATE` em `stores` (nullable — lojas sem data ficam sem controle).
- Job diário com `pg_cron` rodando 00:05 que executa: `UPDATE stores SET is_active = false WHERE license_expires_at < CURRENT_DATE AND is_active = true`.

### 2. Painel Super Admin (`/admin` → `AdminPage.tsx`)
- No card de cada loja, mostrar "Licença até: 31/05/2026" (ou "Sem vencimento" se null).
- Badge colorido:
  - Verde quando faltam >5 dias
  - Amarelo quando faltam ≤5 dias
  - Vermelho quando vencida
- No dialog Editar/Nova Empresa: campo "Data de vencimento da licença" (input date).

### 3. Painel do Lojista (`/:slug/admin` → `StoreAdminPage.tsx`)
- Banner no topo quando `license_expires_at` estiver a ≤5 dias do vencimento (ou vencida):
  > ⚠ Sua licença vence em X dias (DD/MM/AAAA). Entre em contato com o suporte para renovar.
  > [Botão: Falar com Suporte no WhatsApp]
- Botão abre `https://wa.me/5547999625155?text=...` com mensagem pré-preenchida:
  > Olá, quero renovar minha licença da loja "{store.name}" ({slug}). Vencimento: DD/MM/AAAA.

### 4. Constante de suporte
- Criar `src/lib/supportContact.ts` com `SUPPORT_WHATSAPP = '5547999625155'` e helper `buildRenewalLink(store)`.

### Arquivos
- Migration nova (coluna + cron job via `supabase--insert` para o cron)
- `src/lib/supportContact.ts` (novo)
- `src/lib/licenseStatus.ts` (novo — helper `getLicenseStatus(date)` → `{daysLeft, level: 'ok'|'warning'|'expired'}`)
- `src/types/index.ts` — adicionar `licenseExpiresAt?: string` em `Store`
- `src/hooks/useStores.ts` — mapear/salvar campo
- `src/pages/AdminPage.tsx` — badge + campo no form
- `src/pages/StoreAdminPage.tsx` — banner de aviso
