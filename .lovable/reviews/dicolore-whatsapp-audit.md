# Auditoria: finalização e WhatsApp DiColore

**Regra:** o vendedor escolhido deve continuar selecionado e ser gravado no pedido; oferecer o WhatsApp somente depois do salvamento, sem aba vazia nem perda de carrinho/conta. Correções de pedidos abertos preservam o responsável já salvo. Aviso obrigatório exclusivamente DiColore.

## Caminhos lidos

| Caminho | Resultado |
| --- | --- |
| Checkout do cliente, seleção de vendedor/televendas, retorno e recarga | Corrigido: preferência por loja/conta/cliente, validada pelas opções carregadas; aguarda a consulta antes de permitir finalizar. |
| Primeira finalização e verificação de versão do catálogo | Corrigido na DiColore: versão ausente não inventa mudança de preços; mudança conhecida interrompe e recarrega os dados sem recarregar a página. |
| Carrinho aberto diretamente no checkout | Corrigido na DiColore: revalida preços pelo catálogo usando o mecanismo existente, preservando itens/quantidades válidos. |
| Cadastro PROSPECT e retorno à finalização | Conforme: salva o cadastro, atualiza seleção/formulário e mantém o carrinho; destinatário fica separado do formulário. |
| Meus pedidos → edição do orçamento pelo cliente | Corrigido na DiColore: lê o pedido autorizado novamente, exige orçamento não transmitido e preserva criação/responsável/posse salvos, sem oferecer nova escolha de responsável. |
| Checkout do vendedor/televendas, orçamento novo ou em edição e liberação | Conforme: salvamento precede o aviso; edição da equipe usa `mergeEditedCustomer`; no DiColore nenhuma janela vazia é criada. |
| Portal vendedor → finalizar orçamento/liberar | Conforme: lê pedido atual, valida, grava e só então oferece WhatsApp. |
| Pedido pendente do vendedor → liberar | Conforme: pagamento/cadastro validados antes da gravação; aviso depois do sucesso. |
| Diálogo para completar pagamento/liberar | Conforme: leitura autorizada e escrita guardada; aviso após sucesso. |
| Painel da loja → liberar | Conforme: janela legada desativada na DiColore; ação WhatsApp depois da gravação. |
| Diálogo global de aviso de liberação | Conforme: cancelar não navega para fora da loja; link móvel direto e ação explícita. |
| Painel → enviar link de pagamento/rastreio | Conforme com a regra relevante: pedido já existe; abertura ocorre diretamente no clique, sem espera nem seleção transitória. |
| Fila offline e envio ao recuperar conexão | Conforme com preservação: guarda/envia o objeto completo do cliente do pedido, incluindo destinatário; não abre WhatsApp automaticamente. |
| Consulta `get_order_recipients` | Conforme: lista vendedor ativo da carteira e televendas associados na mesma loja; preferência local não muda autorizações. |
| Gravação `mpz_official_order_customer` | Conforme: sobrepõe dados cadastrais oficiais sem remover os campos de responsável. |
| Proteção `dicolore_order_claim_guard` | Conforme: protege posse já assumida; permaneceu inalterada. |
| Trigger/rotina de notificação de pedido pendente | Conforme com o fluxo: dispara somente após gravação; avisos à carteira/admin continuam sendo avisos operacionais, separados do destinatário escolhido para WhatsApp. |
| Exportação ao ERP | Conforme: resolve cadastro oficial e responsável/televendas a partir do pedido; permaneceu inalterada. |
| Aviso de nova versão, atualização e configuração da release | Corrigido/configurado: alvo apenas DiColore, não dispensável; atualização preserva conta/carrinho. |

Nenhum pedido histórico, permissão, configuração comercial ou dado de exemplo foi modificado. Demais lojas conservaram os caminhos legados.

## Verificações e limites

- Testes automatizados de destinatário, versão, direcionamento do aviso, refresh e WhatsApp passaram.
- Conta real 98596 restaurada no navegador: Rita/Grazi disponíveis, escolha Grazi restaurada após recarga; gravação **simulada** gerou confirmação com Grazi, status pendente e uma única aba; cancelamento voltou à DiColore.
- Aviso de versão simulada bloqueou DiColore e não interrompeu JEWOS.
- Não foi criado pedido real nem enviada mensagem/notificação. Teste de salvamento real e passagem Safari/WhatsApp em iPhone físico permanece pendente.
- Publicação necessária para levar código e aviso aos aparelhos; não foi realizada nesta alteração.