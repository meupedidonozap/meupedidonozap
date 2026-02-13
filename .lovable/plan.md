

# Redefinir Senha do Usuario magui2026@gmail.com

## Problema

O usuario `magui2026@gmail.com` existe no sistema de autenticacao (ID: `482a3de7-c10d-4566-9f0f-ea5c78da3042`) e esta corretamente vinculado como admin da loja Magui Papelaria na tabela `store_admins`. Porem, a senha armazenada nao corresponde a `Magui2026`, causando erro "credenciais invalidas" ao tentar fazer login.

## Solucao

Criar uma edge function temporaria que usa a Admin API (service role key) para redefinir a senha do usuario para `Magui2026`. Apos a execucao, a edge function sera removida.

## Passos

### 1. Criar edge function temporaria `reset-user-password`

A funcao recebera o user_id e a nova senha, e usara `supabase.auth.admin.updateUserById()` para atualizar a senha.

### 2. Executar a funcao

Chamar a edge function passando o ID do usuario (`482a3de7-c10d-4566-9f0f-ea5c78da3042`) e a senha `Magui2026`.

### 3. Remover a edge function

Apos confirmar que o login funciona, a funcao temporaria sera deletada por seguranca.

### 4. Testar o login

Acessar `/magui-papelaria/admin` e fazer login com `magui2026@gmail.com` / `Magui2026`.

---

## Arquivo a criar (temporario)

| Arquivo | Acao |
|---|---|
| `supabase/functions/reset-user-password/index.ts` | Criar, executar e depois deletar |

## Nota importante

Nenhuma alteracao no frontend e necessaria. O problema e exclusivamente a senha armazenada no sistema de autenticacao.
