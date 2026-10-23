# Bling → MPZ: tudo automático, preço só no botão

## O que muda para você

**Automático (a cada 15 min, sem clicar):**
- Nome e descrição do produto
- Fotos (novas entram; as que saírem do Bling saem do MPZ)
- Estoque (do produto e de cada cor/tamanho)
- Ativo/Inativo
- Variantes novas (ex.: uma cor nova cadastrada no Bling)
- Produtos novos (entram sem preço, inativos até alguém clicar em Sincronizar)
- Clientes (novos e alterados)

**Só quando clicar no botão "Sincronizar preços" (Configurações):**
- Preço do produto e preço de cada variante

Assim a loja pode trabalhar no MPZ com o preço que quiser: o automático nunca mexe em preço.

## Regras que continuam valendo
- Produto inativado à mão no MPZ não é reativado pelo automático.
- Nada é apagado de pedidos já feitos (itens ficam como foto do momento).
- Em Configurações ficam dois botões: "Importar tudo agora" (mesma coisa que o automático, na hora) e "Sincronizar preços".

## Detalhes técnicos
- `bling-sync` ação `cron`: passa a percorrer os produtos alterados no Bling (`/produtos` com filtro de data de alteração, paginado, poucos por ciclo para não estourar tempo) e roda o mesmo fluxo de `products_batch` com flag `withPrice=false`; depois `images_batch` dos jobs pendentes; depois clientes alterados.
- `products_batch` recebe `withPrice`: quando falso, não grava `base_price`/preço de variante em updates; em criação grava 0 e `is_active=false`.
- Fotos: sincronização completa por produto (adiciona novas pelo hash da URL, remove do MPZ as que não existem mais no Bling).
- Nova ação `prices`: lista paginada, atualiza só preços (produto + variantes), em lotes chamados pelo `BlingConnectCard`.
- Guardar `last_bling_sync_at` nas configurações da loja para o filtro de alterações; vale para todas as lojas conectadas ao Bling.
- `BlingConnectCard.tsx`: botões "Importar tudo agora", "Sincronizar preços", "Importar clientes" com progresso.
