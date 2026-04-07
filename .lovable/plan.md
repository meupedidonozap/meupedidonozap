

# Corrigir erro de RLS ao salvar perfil de cliente

## Diagnóstico

Analisei os logs do banco de dados e encontrei o erro exato:

```
new row violates row-level security policy for table "customer_profiles"
```

A query que falhou é o UPSERT executado por `useUpsertCustomerProfile`. Embora o código já verifique a sessão com `supabase.auth.getSession()`, este método retorna a sessão **cacheada localmente**, que pode estar com o token JWT expirado. Quando o Supabase recebe o token expirado, `auth.uid()` retorna NULL, e a política `auth.uid() = user_id` falha.

## Solução

### 1. `src/hooks/useCustomerProfile.ts` — Trocar `getSession` por validação real

Substituir `supabase.auth.getSession()` por `supabase.auth.getUser()`, que faz uma chamada real ao servidor de autenticação e garante que o token é válido. Se o token estiver expirado, o Supabase client automaticamente tenta refresh antes de retornar.

```typescript
// ANTES (pode retornar sessão com token expirado):
const { data: { session } } = await supabase.auth.getSession();
if (!session?.user) { throw new Error('...'); }
const authenticatedUserId = session.user.id;

// DEPOIS (valida no servidor):
const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
if (authError || !authUser) {
  throw new Error('Sua sessão expirou. Faça login novamente.');
}
const authenticatedUserId = authUser.id;
```

### 2. `src/components/CustomerAuthDialog.tsx` — Aguardar sessão real antes do profile step

Após signup com `hasSession: true`, adicionar um pequeno delay ou polling para garantir que `onAuthStateChange` já propagou o `user` antes de liberar o form de perfil. Isso evita que o form apareça antes da sessão estar totalmente ativa.

### 3. Melhorar mensagem de erro

Na `handleProfileSubmit` e no `catch` do upsert, traduzir erros de RLS para mensagens amigáveis:

```typescript
catch (err: any) {
  const msg = err.message?.includes('row-level security')
    ? 'Sua sessão expirou. Feche esta janela, faça login novamente e tente salvar.'
    : err.message || 'Erro ao salvar perfil';
  toast.error(msg);
}
```

## Resultado esperado

- O token JWT é validado no servidor antes de qualquer operação no banco
- Se o token expirou, o cliente tenta refresh automaticamente
- Se o refresh falhar, o usuário recebe mensagem clara para fazer login novamente
- Novos cadastros funcionam sem erro de RLS

