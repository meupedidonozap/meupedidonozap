

# Corrigir salvamento de regras de desconto na Dicolore

## Diagnóstico

O `updateStore.mutateAsync()` chama `supabase.from('stores').update(dbUpdates).eq('id', id)`. O cliente Supabase **não lança erro quando 0 linhas são atualizadas** — ele retorna `{ data: null, error: null }`. Se a política RLS bloquear o UPDATE silenciosamente, o código cai no `toast.success` mesmo sem ter salvo nada.

Além disso, o código atual no `useUpdateStore` não verifica se a atualização realmente aconteceu.

## Mudanças

### 1. `src/hooks/useStores.ts` — verificar resultado do update

Alterar `useUpdateStore` para usar `.select()` após o `.update()` e verificar se retornou linhas:

```typescript
const { data, error } = await supabase
  .from('stores')
  .update(dbUpdates)
  .eq('id', id)
  .select('id')
  .single();

if (error) throw error;
if (!data) throw new Error('Não foi possível atualizar a loja. Verifique suas permissões.');
```

Isso garante que:
- Se RLS bloquear, `data` será null e um erro será lançado
- O `catch` no `handleSaveDiscountRules` vai capturar e exibir o toast de erro

### 2. `src/pages/StoreAdminPage.tsx` — melhorar feedback

No `handleSaveDiscountRules`, adicionar log para debug e melhorar a mensagem de erro:

```typescript
catch (err: any) {
  console.error('Erro ao salvar regras:', err);
  toast.error(err?.message || 'Erro ao salvar regras');
}
```

## Resultado esperado

- Se o save funcionar: toast de sucesso aparece e os dados persistem
- Se RLS bloquear: toast de erro aparece com mensagem clara
- Em ambos os casos, o admin tem feedback visual do que aconteceu

