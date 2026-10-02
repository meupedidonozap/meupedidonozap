# Notas Fiscais do ERP na DiColore

## O que será entregue
- Criar o espelho seguro das notas fiscais recebidas da VIEW `dw_nota_fiscal`.
- Ampliar o envio atual em Python para transmitir títulos, notas fiscais e boletos no mesmo processo.
- Substituir a tela provisória **Notas Fiscais** do vendedor por uma consulta real, com resumo, busca e filtros.
- Permitir que o cliente logado consulte suas próprias notas pelo Código do Cliente do ERP.
- Manter vendedor e televendas limitados à própria carteira, e administradores com visão completa.
- Respeitar o corte financeiro configurado no painel, sem apagar o histórico sincronizado.

## Regras da tela
- Exibir cliente, número/série, emissão, pedido, status, valores, impostos, frete, desconto, quantidade e chave da NFe.
- Pesquisar por cliente, código, nota, pedido ou chave da NFe.
- Filtrar por período e status disponível no ERP.
- Não oferecer DANFE/XML nesta etapa, pois a VIEW enviada contém dados, mas não o arquivo ou endereço de download.

## Detalhes técnicos
- Nova tabela autenticada com RLS e índices por loja, cliente, vendedor e emissão.
- Sincronização por lotes e atualização pela chave `filial + número + série`.
- O script continuará usando a mesma senha de sincronização já configurada.
- A própria VIEW limita a origem aos últimos 730 dias; a plataforma não conseguirá mostrar registros anteriores sem alterar a VIEW do ERP.

## Validação
- Validar compilação, tela em celular e computador, filtros e permissões com sessão autenticada.
- Entregar uma nova versão do script Python pronta para substituir a anterior no servidor da DiColore.
