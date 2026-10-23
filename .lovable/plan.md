# Importação Bling com variantes e fotos (Jewos)

## Problema
Hoje a importação do Bling ignora o produto "pai" (ex.: Manta Pluma) e cria cada variação como um produto separado (MAN-001-LIL, MAN-001-NUD), sem fotos e sem a opção "Possui Variantes".

## Como vai ficar
1. **Um produto por produto pai do Bling**
   - "Manta Pluma" é criado uma vez só, com **Possui Variantes** ligado.
   - Código do produto = código do pai no Bling (ou o prefixo comum, ex.: MAN-001, se o pai não tiver código).
2. **Cada variação do Bling vira uma variante**
   - Cor (Lilás, Nude) vai para o campo Cor; se o atributo for Tamanho, vai para Tamanho.
   - Código da variação (MAN-001-LIL) vai como código da variante; preço e estoque vêm de cada variação.
   - Variação inativa no Bling fica com estoque 0 (aparece esgotada, em cinza).
3. **Fotos**
   - As fotos do produto pai vão para o carrossel do produto.
   - A foto de cada variação entra no carrossel marcada com a cor, então ao escolher "Lilás" aparece a foto da Lilás.
   - A primeira foto vira a foto principal.
   - Fotos já existentes no MPZ não são apagadas; só entram as que ainda não existem.
4. **Produtos que já foram importados separados**
   - MAN-001-LIL, MAN-001-NUD e outros nessa situação ficam **inativos** (não são apagados, para não perder o histórico de pedidos) e passam a ser variantes do produto novo.
5. **Sincronização de estoque a cada 15 min** continua, agora atualizando o estoque de cada variante.
6. Produtos simples (sem variação) continuam como hoje, agora também trazendo as fotos.

## Regras mantidas
- Produto novo entra inativo para completar preço/categoria (como hoje).
- Situação Ativo/Inativo continua vindo do Bling.
- Código BLING continua sendo usado no XML Bling (cada variante leva o código dela).

## Detalhes técnicos
- `supabase/functions/bling-sync/index.ts`:
  - Lista `/produtos` (criterio=5); para itens `formato === 'V'` busca `/produtos/{id}` para obter `variacoes[]` (codigo, preco, situacao, estoque.saldoVirtualTotal, `variacao.nome` como "Cor:Lilás;Tamanho:P", `midia.imagens.internas/externas[].link`) e `midia` do pai.
  - Filhos (`variacao.produtoPai.id` preenchido) que vierem na listagem são ignorados no loop principal e tratados via o pai.
  - Upsert do produto pai por `bling_code` = código do pai; `has_variants = true`.
  - Upsert em `product_variants` por `sku`; parse do nome do atributo (cor/tamanho, case/acentos tolerantes).
  - Fotos: insere em `product_images` (label = cor da variante) evitando URLs repetidas; `image_url` = primeira foto se vazio. Links internos do Bling expiram, então as imagens são baixadas e reenviadas para o armazenamento `product-images`.
  - Produtos avulsos antigos cujo `code` é igual a um SKU de variação são marcados `is_active = false`.
  - Respeita limite de 3 req/s do Bling (pausa de 350 ms) e o retorno passa a incluir `variantsUpdated` e `imagesAdded`.
- `src/components/BlingConnectCard.tsx`: mensagem final mostra variantes e fotos importadas.
- Validação: rodar "Importar produtos e estoque" na Jewos e conferir Manta Pluma com 2 variantes e fotos.
