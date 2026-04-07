

# Corrigir erro no cadastro de clientes

## Diagnóstico

O trigger `on_auth_user_created` executa a função `handle_new_user()` toda vez que um usuário se cadastra. Essa função tenta:

```sql
INSERT INTO public.customer_profiles (user_id, email)
VALUES (new.id, new.email);
```

**Dois problemas fatais:**
1. A tabela `customer_profiles` **não tem coluna `email`** — o INSERT falha com "column does not exist"
2. A coluna `store_id` é **NOT NULL** sem default — mesmo que `email` existisse, falharia por falta de `store_id`

Resultado: toda tentativa de signup falha silenciosamente no banco.

## Solução

**Remover o trigger e a função** — eles são desnecessários porque o perfil do cliente já é criado na etapa 2 do cadastro (via `useUpsertCustomerProfile`), que inclui o `store_id` correto.

### Migração SQL

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
```

### Nenhuma outra mudança

O fluxo de cadastro em `CustomerAuthDialog.tsx` + `useUpsertCustomerProfile` já cria o perfil corretamente com todos os campos. Basta remover o trigger que está impedindo o signup.

