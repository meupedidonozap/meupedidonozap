
# Exibir Logo da Loja no Header

## O que muda

No header da loja (linha 165-166 de `ProductStorePage.tsx`), onde atualmente aparece apenas o nome da loja como texto, sera adicionada a imagem do logo cadastrado na tabela `stores` (campo `logo`).

Se a loja tiver um logo cadastrado, ele aparece ao lado do nome. Se nao tiver, continua exibindo apenas o nome.

## Detalhes Tecnicos

### Arquivo a modificar
- `src/pages/ProductStorePage.tsx`

### Mudanca
Alterar o bloco do Link (linhas 165-166) para incluir a imagem do logo:

```text
<Link to={`/${store.slug}`} className="flex-shrink-0 flex items-center gap-2">
  {store.logo && (
    <img src={store.logo} alt={store.name} className="h-10 w-10 rounded-full object-cover" />
  )}
  <h1 className="text-lg font-bold">{store.name}</h1>
</Link>
```

O campo `store.logo` ja existe no banco de dados (coluna `logo` da tabela `stores`) e ja e carregado pelo hook `useStoreBySlug`. A imagem sera exibida como um circulo de 40x40px ao lado do nome.
