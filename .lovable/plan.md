
# Corrigir Erro de Autenticação no Cadastro de Cliente

## Causa Raiz

O fluxo de cadastro tem a seguinte sequência:

1. `signUp()` é chamado — o Supabase envia e-mail de confirmação e retorna `{ data: { user }, error }`
2. Como o e-mail não foi confirmado, **nenhuma sessão ativa é criada** e o hook `useAuth` mantém `user = null`
3. O dialog avança para o passo 2 (formulário de perfil)
4. Ao submeter o perfil, `handleProfileSubmit` verifica `if (!user)` e bloqueia com o erro **"Erro de autenticação. Tente novamente."**

O Supabase **retorna o objeto do usuário** na resposta do `signUp` mesmo antes da confirmação de e-mail, mas o código atual descarta esse dado (`const { error } = await supabase.auth.signUp(...)` — ignora o `data`).

## Solução

### 1. `src/hooks/useAuth.ts`
Alterar a função `signUp` para também retornar o objeto `user` da resposta:

```typescript
const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ ... });
  return { user: data?.user ?? null, error };
};
```

### 2. `src/components/CustomerAuthDialog.tsx`

Duas mudanças:

**a) Adicionar estado local para guardar o userId do cadastro:**
```typescript
const [pendingUserId, setPendingUserId] = useState<string | null>(null);
```

**b) Em `handleRegister`, capturar o userId retornado pelo signUp:**
```typescript
const { user: newUser, error } = await signUp(registerData.email, registerData.password);
if (!error && newUser) {
  setPendingUserId(newUser.id);
  setStep(2);
}
```

**c) Em `handleProfileSubmit`, usar `pendingUserId` como fallback quando `user` for null:**
```typescript
const effectiveUserId = user?.id ?? pendingUserId;
if (!effectiveUserId) {
  toast.error('Erro de autenticação. Tente novamente.');
  return;
}
// usar effectiveUserId no lugar de user.id
```

## Por que isso funciona?

O Supabase cria o usuário imediatamente no banco ao chamar `signUp`, mas aguarda a confirmação do e-mail para ativar a sessão. O `user.id` retornado na resposta é o ID real do usuário já criado, e pode ser usado para salvar o perfil via RLS (a política de RLS verifica `user_id = auth.uid()`, mas como o usuário ainda não está autenticado via sessão, pode ser necessário verificar a política da tabela `customer_profiles`).

## Verificação das políticas RLS

Será necessário verificar se a tabela `customer_profiles` permite inserção por usuários não confirmados. Se a RLS exige sessão ativa, a alternativa mais robusta seria **desabilitar a confirmação de e-mail** para cadastros de clientes (configuração no sistema de autenticação do Lovable Cloud), que é o comportamento mais comum em lojas de e-commerce onde o cadastro deve ser imediato e sem fricção.

## Arquivos modificados

1. `src/hooks/useAuth.ts` — retornar `user` no `signUp`
2. `src/components/CustomerAuthDialog.tsx` — capturar e usar o `pendingUserId`

## Alternativa mais simples e robusta

Desabilitar a confirmação de e-mail no painel de autenticação do Lovable Cloud, pois para um e-commerce de loja local (como a LF Store), pedir que o cliente confirme o e-mail antes de comprar é uma barreira desnecessária que prejudica a conversão. Esta é a mudança mais impactante e simples de implementar.

A implementação fará as duas coisas:
1. Desabilitar a confirmação de e-mail via migração de configuração
2. Também corrigir o código para capturar o `pendingUserId` como proteção extra
