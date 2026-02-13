
# Layout de Impressao para Impressora Termica (80mm)

## Resumo

Reformular o HTML de impressao do pedido para o formato de bobina termica de 80mm, compativel com a impressora Diebold IM433TD. O layout atual em A4 com grid e tabela larga sera substituido por um layout estreito, sequencial, estilo cupom.

---

## O que muda

O arquivo `src/lib/printOrder.ts` sera reescrito com um layout otimizado para papel de 80mm (largura util ~72mm):

### Caracteristicas do novo layout

- **Largura fixa**: `max-width: 280px` (equivalente a ~72mm a 96dpi)
- **Fonte monospacada**: `font-family: 'Courier New', monospace` para alinhamento consistente
- **Fonte pequena**: `font-size: 11px` como base, titulos em 13px
- **Sem grid**: tudo em coluna unica, sequencial
- **Separadores com tracejado**: linhas `- - - - -` entre secoes
- **@page sem margens**: `@page { margin: 2mm; }` para aproveitar o papel
- **Itens empilhados**: cada item em bloco (nome, codigo, qtd x preco = total) em vez de tabela com 9 colunas
- **Sem cores de fundo**: apenas texto preto em fundo branco

### Estrutura do cupom

```text
================================
      NOME DA LOJA
================================
Pedido #123 | 13/02/2026 14:30
--------------------------------
CLIENTE
Nome: Fulano de Tal
CPF: 123.456.789-00
Fone: (11) 99999-9999
End: Rua X, 123 - Bairro
     Cidade/UF - 12345-678
Entrega: Manha
Pagto: PIX
--------------------------------
ITENS
1) Camiseta Branca
   Cod: SKU-01 | Tam: M | Cor: Branca
   1 x R$ 49,90 = R$ 49,90

2) Calca Jeans
   Cod: SKU-02
   2 x R$ 89,90 = R$ 179,80
--------------------------------
Subtotal:        R$ 229,70
Desconto:       -R$ 20,00
Taxa entrega:    R$ 10,00
================================
TOTAL:           R$ 219,70
================================
Obs: Entregar no portao
--------------------------------
Gerado em 13/02/2026 14:30
```

---

## Detalhes Tecnicos

### Arquivo modificado
- `src/lib/printOrder.ts` - reescrever a funcao `buildOrderHTML` com o novo layout termico

### CSS de impressao

```css
@page { margin: 2mm; width: 80mm; }
body {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  width: 280px;
  margin: 0 auto;
  padding: 4px;
  color: #000;
}
```

### Itens em bloco (sem tabela)

Cada item sera renderizado como um bloco `<div>` com nome, detalhes opcionais (codigo, tamanho, cor) e calculo `qtd x preco = total`, em vez da tabela de 9 colunas que nao cabe em 80mm.

### Funcao `printOrder` permanece igual

A mecanica de criacao do iframe e chamada de `window.print()` nao muda - apenas o HTML gerado e diferente.
