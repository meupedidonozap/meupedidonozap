## Ajuste de texto — botão do Modo Garçom

Na barra laranja fixa inferior (visível antes e atrás do sheet de revisão), trocar o texto **"Revisar Pedido"** por **"Enviar Pedido"**, mantendo contagem de itens e total.

### Arquivo
- `src/components/WaiterModeFAB.tsx`

### Mudança
No botão da barra inferior:
- "Adicione itens para revisar" → "Adicione itens para enviar"
- `Revisar Pedido (N itens • R$ X)` → `Enviar Pedido (N itens • R$ X)`

O sheet de revisão continua abrindo ao clicar (fluxo: clica → revisa itens/quantidades/observações → confirma com "Lançar na Mesa"). Nenhuma outra mudança de comportamento.