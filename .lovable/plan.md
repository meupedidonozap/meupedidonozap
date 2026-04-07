
# Corrigir erro ao finalizar o cadastro do endereço

## Diagnóstico

O problema atual não é mais o trigger antigo. Agora o erro acontece porque o fluxo do cadastro avança para a etapa de endereço **antes de existir uma sessão autenticada válida**.

Hoje o código faz isso:

- `signUp()` cria a conta
- o front guarda `pendingUserId`
- libera a etapa 2 do cadastro
- tenta inserir em `customer_profiles`

Mas a política de segurança da tabela exige:

```sql
WITH CHECK (auth.uid() = user_id)
```

Ou seja: não basta ter o `user_id` em memória. O banco só aceita a gravação se a requisição estiver autenticada como esse usuário. Se não houver sessão ativa ainda, a inserção cai em:

```text
new row violates row-level security policy for table "customer_profiles"
```

## Implementação

### 1. Ajustar `src/hooks/useAuth.ts`
Fazer o `signUp` retornar também o estado real da autenticação após o cadastro, não só o `user`.

Objetivo:
- distinguir **conta criada + sessão ativa**
- de **conta criada sem sessão ativa** (ex.: precisa confirmar e-mail)

### 2. Ajustar `src/components/CustomerAuthDialog.tsx`
Corrigir o fluxo em dois pontos:

- parar de depender de `pendingUserId` como se ele autorizasse o insert
- só permitir salvar o endereço quando houver `user?.id` real da sessão

Novo comportamento:
- se o cadastro já gerar sessão, continua para “Complete seu Cadastro”
- se criar conta mas não gerar sessão, **não tenta salvar perfil**; mostra mensagem amigável pedindo confirmação do e-mail e login
- em `handleProfileSubmit`, se não houver usuário autenticado, bloquear antes da mutation com mensagem clara

### 3. Ajustar `src/hooks/useCustomerProfile.ts`
Fortalecer `useUpsertCustomerProfile()` para ficar compatível com a RLS atual:

- verificar o usuário autenticado antes do `upsert`
- usar o usuário autenticado como fonte da verdade para `user_id`
- se não houver sessão, lançar erro amigável de autenticação em vez de deixar o banco responder com erro técnico de RLS

## O que NÃO vou mudar

- não vou afrouxar a RLS da tabela `customer_profiles`
- não vou liberar insert público
- não precisa alterar a estrutura da tabela para corrigir esse bug

Isso evita bagunçar o que já está funcionando e mantém a segurança correta do cadastro do cliente.

## Fluxo corrigido

```text
Cadastro
  -> signUp
      -> sessão ativa?
           -> sim: abre etapa de endereço -> salva perfil
           -> não: avisa para confirmar e-mail / fazer login
```

## Resultado esperado

- o usuário não verá mais a mensagem técnica de RLS
- se estiver autenticado, consegue concluir o endereço normalmente
- se ainda não estiver autenticado, recebe a orientação correta sem quebrar o fluxo
- checkout e atualização do perfil continuam funcionando como hoje para usuários já logados

## Detalhe técnico importante

Se vocês quiserem que o cliente consiga **sempre** concluir tudo imediatamente após o cadastro, sem precisar confirmar e-mail antes, isso depende também da configuração da autenticação. Mas a correção principal no código é esta: **o formulário de endereço só pode gravar no banco quando existir sessão real**, não apenas um `userId` retornado pelo signup.
