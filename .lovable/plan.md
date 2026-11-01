# Fotos do produto, WhatsApp no rodapé e cadastro de vendedores

## 1. Clicar na foto abre a página do produto
- Ao tocar na foto (grade e lista), abre uma janela grande do produto com:
  - Carrossel com todas as fotos (foto principal + fotos extras já cadastradas no produto), com setas e miniaturas, deslizar no celular.
  - Nome, código, descrição completa, preço (com promoção, se houver), estoque e variações (cor/tamanho) quando existirem.
  - Botão "+ Adicionar" que usa o mesmo fluxo de compra atual (para variações abre a escolha de cor/tamanho).
- Fotos sempre em fundo branco, sem cortar a imagem.
- Vale para todas as lojas do tipo produto (JEWOS, DiColore etc.).

## 2. Telefone do rodapé abre o WhatsApp
- O telefone no rodapé vira link: ao tocar abre o WhatsApp da loja (usa o número de WhatsApp cadastrado; se não houver, o telefone) com uma mensagem "Olá, vim pelo catálogo da loja ...".

## 3. Cadastro de vendedores para todas as lojas
- Hoje a seção "Vendedores" no painel só aparece para a DiColore. Ela passa a aparecer em todas as lojas (incluindo JEWOS), em Configurações.
- Na aba Usuários, o admin cria o login da pessoa e escolhe o perfil "Vendedor" (ou Televendas) vinculado ao vendedor cadastrado; esse usuário entra no modo vendedor no catálogo.
- As regras próprias da DiColore (sem pedido mínimo, troca de cliente etc.) continuam só na DiColore.

## Detalhes técnicos
- Novo `ProductDetailDialog` usando `product_images` (já existe) + `image_url`; acionado por onClick nas `<img>` de `ProductStorePage` (linhas ~689 e ~732).
- Rodapé: `<a href="https://wa.me/55{digits}?text=...">` com `whatsapp || phone`.
- `StoreAdminPage`: remover a restrição `usesSellerRule` apenas da renderização do card de vendedores; manter as regras de negócio DiColore intactas. Verificar se `useSellerMode` funciona fora da DiColore e ajustar se estiver condicionado ao slug.
