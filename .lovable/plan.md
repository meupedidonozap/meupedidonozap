
# Corrigir Criação de Admin de Loja no Painel Central

## Causa Raiz Identificada

O fluxo atual em `AdminPage.tsx` (`handleCreateAdmin`, linha 135–183) tem uma falha crítica de sessão:

```
1. Superadmin abre o dialog → clica "Criar Admin"
2. supabase.auth.signUp(email, password)  ← cria o novo usuário
3. O Supabase faz LOGIN AUTOMÁTICO com o novo usuário (derruba a sessão do superadmin)
4. supabase.auth.signOut()               ← desloga o novo usuário
5. supabase.from('store_admins').insert() ← FALHA: auth.uid() = null
   → RLS bloqueia porque is_platform_admin(null) = false
6. O toast de ERRO aparece (linkError), mas o usuário foi criado sem o vínculo
```

**Confirmado pelo banco:** O usuário `logistica@dicolore.com.br` existe na tabela de autenticação (ID: `93bf8067...`), mas a tabela `store_admins` está **completamente vazia** para ele.

## Solução

### Opção escolhida: Edge Function com Service Role

A única forma segura de criar um usuário E vincular à loja sem perder a sessão do superadmin é usar uma **Edge Function** que:
1. Recebe email, senha e store_id
2. Usa o **service role key** (acesso total ao banco sem RLS) para criar o usuário via Admin API
3. Insere o registro em `store_admins` com o service role (também sem RLS)
4. A sessão do superadmin **nunca é interrompida**

### Fluxo Corrigido

```
AdminPage.tsx
  ↓ chama edge function com { email, password, store_id }
  
Edge Function: create-store-admin
  ↓ usa Admin Auth API → cria usuário (sem afetar sessão do chamador)
  ↓ usa service role → insere em store_admins
  ↓ retorna { success: true, userId }
  
AdminPage.tsx
  ↓ mostra toast de sucesso
  ↓ sessão do superadmin intacta ✓
```

## Arquivos a Modificar/Criar

### 1. Nova Edge Function: `supabase/functions/create-store-admin/index.ts`

Recebe `{ email, password, store_id }` no body, valida que o chamador é platform admin usando o JWT da requisição, cria o usuário via Admin Auth API e insere em `store_admins`.

```typescript
// Pseudo-código da lógica
const { email, password, store_id } = await req.json();

// 1. Verificar que o chamador é platform admin
const { data: { user } } = await supabaseAdmin.auth.getUser(token);
const { data: isAdmin } = await supabaseAdmin.rpc('is_platform_admin', { _user_id: user.id });
if (!isAdmin) return 403;

// 2. Criar o usuário (ou buscar existente)
const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
  email, password, email_confirm: true
});

// 3. Vincular à loja
await supabaseAdmin.from('store_admins').insert({ store_id, user_id: newUser.user.id });

return { success: true };
```

### 2. `src/pages/AdminPage.tsx` — `handleCreateAdmin`

Substituir todo o bloco de signUp/signIn pela chamada à edge function:

```typescript
const handleCreateAdmin = async () => {
  setAdminLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-store-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword, store_id: adminStoreId }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Erro ao criar admin');
    toast.success(`Admin criado para ${adminStoreName}!`);
    setAdminDialogOpen(false);
  } catch (err: any) {
    toast.error(err.message || 'Erro ao criar admin');
  }
  setAdminLoading(false);
};
```

### 3. Correção imediata no banco para a DICOLORE

Além de corrigir o código, precisamos **inserir manualmente** o registro que deveria ter sido criado. Isso será feito via migração SQL:

```sql
INSERT INTO store_admins (store_id, user_id)
VALUES (
  '3b77c581-4c30-4c43-a3d5-944eb9f3032a',  -- DICOLORE store id
  '93bf8067-6b4a-414f-bb6c-562e6961e43a'   -- logistica@dicolore.com.br user id
)
ON CONFLICT DO NOTHING;
```

Isso permite que o admin da DICOLORE acesse o painel imediatamente, enquanto o bug do código também é corrigido.

## Resumo das Mudanças

| O que | Onde | Por quê |
|---|---|---|
| INSERT manual no banco | Migração SQL | Corrigir o DICOLORE agora |
| Nova Edge Function | `supabase/functions/create-store-admin/` | Criar admin sem derrubar sessão do superadmin |
| Atualizar `handleCreateAdmin` | `src/pages/AdminPage.tsx` | Chamar a edge function em vez de signUp direto |
