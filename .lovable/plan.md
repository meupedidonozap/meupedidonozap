
## Ajuste de Truncamento no Modo Grade (Grid)

### Diagnóstico

A alteração anterior corrigiu o modo lista (`line-clamp-3`). O modo grade ainda usa `line-clamp-2` na linha 361:

```html
<h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
```

### Mudança

**Arquivo:** `src/pages/ProductStorePage.tsx` — linha 361

**Antes:**
```html
<h3 className="text-sm font-medium line-clamp-2">{product.name}</h3>
```

**Depois:**
```html
<h3 className="text-sm font-medium line-clamp-3">{product.name}</h3>
```

### Resultado

- **Modo lista:** já exibe até 3 linhas (alteração anterior)
- **Modo grade:** passa a exibir até 3 linhas — comportamento consistente com o modo lista
- O card de grade vai expandir verticalmente conforme necessário para acomodar nomes maiores

### Impacto

1 linha alterada, sem efeitos colaterais.
