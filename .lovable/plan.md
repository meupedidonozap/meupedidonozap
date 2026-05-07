## Diagnóstico

A consulta de produtos está falhando com erro 400:

```
Could not find a relationship between 'products' and 'salon_service_professionals' in the schema cache (PGRST200)
```

Isso acontece porque o `useProducts` faz embed `salon_service_professionals(professional_id)`, mas a tabela `salon_service_professionals` não possui foreign key apontando para `products(id)` — ela foi criada originalmente apontando para `salon_services`. Sem FK, o PostgREST não consegue embutir o relacionamento.

Consequências visíveis:
- Lista de produtos retorna erro (aparece "Nenhum produto cadastrado").
- Após salvar um novo produto, o refetch falha → produto "some".
- A aba **Salão > Profissionais** existe (no `SalonAdminTab`), mas como a página de admin está com erro de query, o usuário pode não estar vendo o conteúdo correto.

## Correção (migração)

Adicionar foreign key faltante:

```sql
ALTER TABLE public.salon_service_professionals
  ADD CONSTRAINT salon_service_professionals_service_id_products_fkey
  FOREIGN KEY (service_id) REFERENCES public.products(id) ON DELETE CASCADE
  NOT VALID;
```

Observação: como `service_id` também pode apontar para `salon_services` (legado), uso `NOT VALID` para não falhar com dados existentes e crio a FK apenas para permitir o embed via PostgREST. Linhas órfãs (que não existem em `products`) continuam aceitas porque a constraint não é validada retroativamente — e o uso novo só insere com IDs reais de `products`.

Alternativa mais limpa (se preferir): limpar primeiro qualquer linha cujo `service_id` não exista em `products` E em `salon_services`, depois adicionar FK validada apenas para products. Vou seguir a abordagem `NOT VALID` por ser não-destrutiva.

Após a migração, recarregar o schema do PostgREST (automático no Supabase em alguns segundos).

## Verificação

1. Recarregar `/alphanobre/admin` → aba Produtos lista os produtos cadastrados.
2. Aba **Salão** aparece (já existe no código quando `store.type === 'SALAO' && isAdmin`) → sub-aba **Profissionais** permite cadastrar.
3. Criar/editar produto SALAO com profissionais vinculados → salva e aparece na lista.

## Fora de escopo

- Nenhuma mudança em UI ou lógica de cadastro: o formulário de produto SALAO já está pronto (campos duração + profissionais).
- Nenhuma alteração em RLS (já está correta).
