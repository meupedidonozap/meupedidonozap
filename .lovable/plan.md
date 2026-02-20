
## Ajuste de Truncamento do Nome do Produto no Modo Lista (Mobile)

### Diagnóstico

No arquivo `src/pages/ProductStorePage.tsx`, linha 344, o modo de lista usa `line-clamp-1` para o nome do produto:

```html
<h3 className="font-medium line-clamp-1">{product.name}</h3>
```

Isso faz com que nomes longos como "Manutenção ou..." sejam cortados na primeira linha, prejudicando a leitura em mobile.

### Mudança

**Arquivo:** `src/pages/ProductStorePage.tsx` — linha 344

**Antes:**
```html
<h3 className="font-medium line-clamp-1">{product.name}</h3>
```

**Depois:**
```html
<h3 className="font-medium line-clamp-3">{product.name}</h3>
```

### O que muda visualmente

- **Modo lista:** o nome do produto passa a exibir até 3 linhas antes de truncar com "..."
- **Modo grade (grid):** mantém `line-clamp-2` — sem alteração
- O card em lista vai expandir verticalmente conforme necessário para acomodar nomes maiores, mantendo o layout responsivo

### Impacto

Apenas 1 linha alterada, sem efeitos colaterais em outros componentes ou modos de visualização.
