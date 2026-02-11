
# Implementar Impressao de Pedido em PDF

## Problema
O botao de impressao na aba "Pedidos" do painel admin apenas exibe um toast ("Pedido enviado para impressao") sem gerar nenhum documento.

## Solucao
Criar uma funcao que gera um PDF formatado do pedido usando a API nativa do navegador (`window.print()`), seguindo o layout de referencia fornecido:

- **Cabecalho**: Nome da loja em destaque + data/hora
- **Dados do Cliente**: Nome, CPF/CNPJ, WhatsApp, endereco, pagamento, turno de entrega, observacoes
- **Tabela de Itens**: Numero, codigo, produto, tamanho, cor, quantidade, valor unitario, desconto, total
- **Rodape**: Subtotal, desconto e TOTAL em destaque

## Implementacao

### 1. Criar componente `OrderPrintView`
Arquivo: `src/components/OrderPrintView.tsx`

Um componente React que renderiza o layout do pedido em HTML puro (sem Tailwind), otimizado para impressao. Sera montado em um iframe oculto para disparar `window.print()`.

### 2. Criar funcao utilitaria `printOrder`
Arquivo: `src/lib/printOrder.ts`

Funcao que:
1. Cria um iframe invisivel no DOM
2. Injeta o HTML formatado do pedido
3. Chama `window.print()` no iframe
4. Remove o iframe apos a impressao

### 3. Atualizar `StoreAdminPage`
Substituir o `toast.success('Pedido enviado para impressao')` pela chamada real da funcao `printOrder`, passando os dados do pedido e o nome da loja.

## Detalhes Tecnicos

- Nao sera necessario instalar nenhuma biblioteca externa (sem jsPDF ou similar)
- O PDF sera gerado via dialogo de impressao nativo do navegador (permite salvar como PDF ou imprimir direto)
- O HTML do pedido usara estilos inline para garantir consistencia na impressao
- O layout seguira fielmente o modelo de referencia com tabela de itens, dados do cliente e totais
