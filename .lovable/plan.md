# Modos de visualização configuráveis + quantidade no modo QUADRO

## 1) Configuração por loja (painel ADM, todas as lojas)

Na aba **Configurações** do painel da loja, novo card "Visualização do catálogo" com dois interruptores:

- Modo LISTA: ATIVO / INATIVO
- Modo QUADRO: ATIVO / INATIVO

Regras:
- Salvo junto com as demais configurações da loja (campo `settings`), sem migração de banco.
- Padrão para lojas existentes: ambos ativos (nada muda até a loja configurar).
- Não é permitido desativar os dois: ao desligar o último ativo, o outro é ligado automaticamente.

Na vitrine:
- Se os dois estiverem ativos, os botões LISTA/QUADRO continuam aparecendo como hoje.
- Se só um estiver ativo, os botões somem e a loja abre sempre nesse modo.

## 2) Quantidade direto no modo QUADRO

Em cada card do modo QUADRO:
- Produto ainda não no carrinho: continua o botão "+" atual.
- Produto já no carrinho: o "+" vira o controle "− [qtd] +", igual ao do carrinho.
- Diminuir até 0 remove o item e o card volta a exibir o "+".

Sincronização com o carrinho:
- O controle lê e escreve direto no carrinho (mesma fonte de dados), então alterar a quantidade no carrinho e voltar a comprar mostra a quantidade atualizada no card, e vice-versa.
- Produtos com variações (cor/tamanho) mantêm o "+" abrindo o seletor de variação; o controle de quantidade não se aplica a eles.
- Respeita as regras já existentes de estoque (ESGOTADO bloqueia) e de preço zerado por tabela.

## Detalhes técnicos

- `src/types/index.ts`: adicionar `catalogViewModes?: { list: boolean; grid: boolean }` em `StoreSettings`.
- `src/pages/StoreAdminPage.tsx`: estado + card de toggles na aba Configurações, incluído no payload de salvamento das settings.
- `src/pages/ProductStorePage.tsx`: derivar modos permitidos das settings, inicializar/forçar `viewMode` conforme permitido, esconder os botões quando só houver um modo; no grid, usar `cart.items` + `updateQuantity`/`removeItem`/`addItem` do `CartContext` para renderizar o stepper.
