# Roadmap

## Confirmação de atualização exclusiva do APK DiColore
- [x] Restringir perguntas e consultas locais ao APK Android; restaurar consultas online, pesquisa e atualização na retomada nos navegadores
- [x] 25 testes passaram: confirmação/recusa do APK, consultas e busca online no navegador, retomada sem reconsultar relatórios no APK; Títulos reais abertos automaticamente pelo menu com sessão autorizada, sem pergunta ou erro; build OK
- [ ] Disponibilizar no site — depende de publicação pelo usuário

## Dados locais e atualização sob confirmação DiColore
- [x] Notas, Pedidos, Títulos e Resultados: perguntar na entrada, usar dados locais ao recusar e atualizar somente a área confirmada; buscas locais preservam a lista
- [x] Preservar atualização automática de clientes e estoque por novo pedido, sem reconsultar relatórios na retomada; carteira filtrada por vendedor
- [x] Isolar cache por conta e escopo confirmado; primeira carga, reentrada, falha/offline e outras lojas cobertas por testes
- [x] 90 testes passaram e build OK; títulos reais atualizados/relidos no computador sem novas consultas na recarga/retomada; 37 notas reais atualizadas/relidas no celular; perguntas/recusa em Vendas e Resultados verificadas a 390px sem erros
- [ ] Disponibilizar no site e confirmar no APK físico — depende de publicação e aparelho do usuário; listas amplas de notas/pedidos/resultados na conta admin não tiveram leitura completa verificada no navegador (limite de execução), regras de aprovação cobertas por testes

## Orçamento por áreas Limpa Telhas Brusque
- [x] Medição direta/calculada por área, inclinação e soma por serviço, com validação oficial
- [x] Placas solares e faixas de quedas configuráveis; endereço por CEP e cálculo protegido de deslocamento de ida e volta a R$1,20/km
- [x] Fotos editáveis no admin e ícone para foto ausente ou quebrada; upload salvo e relido na tela, foto anterior restaurada
- [x] 27 testes passaram, oito com gravação real; orçamento 130+50=180m² salvo/relido com preço oficial, adicionais e endereço do local; computador/390px sem erro; dados temporários removidos
- [x] Base cadastrada, alterada de número 10 para 20 e relida pelo Painel Admin; configurações de teste restauradas; valores dos adicionais preenchidos pelo administrador
- [ ] Preencher base e adicionais reais e validar o trajeto no site publicado — depende do administrador e publicação; Google Maps não pode ser testado neste ambiente

## Menu estável por perfil DiColore
- [x] Validar com a sessão autorizada da Rita: carteira real de pedidos/títulos, recarga, retomada, entradas antigas, Painel/Ver Loja e seleção 86877 → catálogo → finalização com tabela 4; nenhuma gravação de pedido/perfil nem erro de execução
- [x] Auditar catálogo, finalização, histórico, material técnico, dados da conta, pagamento, painel, atendimento, clientes, resultados, notas, títulos, login/retomada e proteção do servidor; registros concluídos e integração ERP intocados
- [x] Carregamento/erro não viram perfil cliente; consulta de acesso compartilhada e não persistida evita identidade parcial ou de outra conta; preços aguardam perfil confirmado só na DiColore
- [x] Menu único por perfil em todas as entradas da DiColore, preservando tabela, carteiras, representante da NF e permissões oficiais; painel delegado não concede privilégios de admin
- [x] 88 testes passaram; cinco perfis simulados em computador/celular, navegação real da Rita a 390px, menu/carteira/finalização conferidos visualmente; build OK; outras lojas preservadas
- [ ] Disponibilizar correção e aviso obrigatório somente DiColore — depende de publicação pelo usuário; não exige novo APK

## Boletos no APK DiColore
- [x] Conectar os boletos autorizados ao visualizador e salvamento/compartilhamento existentes, preservando o PDF bancário original e o download nos navegadores
- [x] 22 testes passaram; boleto bancário real de 32.775 bytes baixado no navegador e renderizado no Android simulado a 390px com zoom; cancelar/salvar/compartilhar preservam os bytes originais, sem erros; build OK
- [x] Usuário confirmou funcionamento dos boletos no APK após publicação

## Identificação dos produtos sem preço no recálculo DiColore
- [x] Exibir todos os nomes/códigos e a tabela numa janela consultável, preservando o bloqueio e os valores do pedido
- [x] Conferir e ajustar avisos equivalentes na edição (abertura e troca de tabela), criação, carrinho/catálogo e finalização; outras lojas mantêm seus avisos
- [x] Ler recalculate_customer_order, enforce_customer_discount_policy e gravação/exportação: permissões, preços oficiais e registros concluídos intocados; nenhum ajuste no banco ou integradores
- [x] 23 testes passaram; painel autenticado #973 em computador/390px, preço zero da caixa simulado apenas na resposta do catálogo porque já estava corrigido; lista de um item e rolagem de 65 itens, fechamento, ausência de gravação e leitura inalterada do pedido confirmados; build OK

## PDF e permissões no APK Android
- [x] Entregar PDF por recursos nativos no APK, com prévia local/zoom/páginas, salvamento por seletor e compartilhamento; preservar navegador e finalização sem gravação
- [x] Disponibilizar Baixar PDF nos pedidos MPZ DiColore independentemente do status, mantendo autorização; pedidos exclusivamente ERP mantêm a tela existente
- [x] Solicitar contatos somente para leitura e localização em uso no Android; usar GPS nativo no check-in/check-out sem rastreamento contínuo
- [x] 37 testes passaram; sessão autorizada, download/preview desktop e 390px; chamadas Android simuladas, cancelamento, GPS e 3 páginas conferidos; código completo dos scripts e guia para sincronizar/recompilar entregues
- [ ] Disponibilizar alterações no site e instalar o APK atualizado — depende de publicação, compilação local e instalação pelo usuário
- [ ] Confirmar permissões e PDF em Android físico — depende de nova compilação local e aparelho
- [ ] Confirmar Ver PDF na pergunta de liberação do vendedor — depende de sessão de vendedor e APK; sessão disponível era admin, sem acesso a essa pergunta

## Limpa Telhas Brusque
- [x] Loja SERVICOS isolada; três serviços em produtos, preço próprio por tipo e adicionais editáveis em Serviços
- [x] Cadastro/login existente por loja, aceite com pedido/OS/conta únicos, solicitação de horário e confirmação da empresa; WhatsApp direto após salvar orçamento/agendamento
- [x] Menu lateral completo; clientes, estoque, compras com recebimento, contas e caixa realizado integrados; bloqueio/reabertura de horários sem sobreposição
- [x] 19 testes passaram (10 com gravação real); cadastro, orçamento R$550, aceite, agenda, confirmação, conclusão, pagamento e compra/estoque relidos na tela; cliente bloqueado no painel, celular/desktop sem overflow; dados temporários removidos
- [x] WhatsApp +55 47 9711-5829 configurado; preços comerciais não inventados, cadastro disponível em Serviços
- [ ] Preencher preços comerciais — depende dos valores definidos pelo administrador; sem preço, pedido aguarda avaliação
- [ ] Disponibilizar as novas telas no site publicado — depende de publicação; e-mail automático não ativado, WhatsApp requer confirmar envio no aplicativo

## Acesso automático dos clientes DiColore
- [x] Auditar clientes: 10.355 códigos ERP sem vínculo (2.406 ativos), dois já têm conta recuperável; 5.439 vinculados têm senha e confirmação, incluindo quatro logins personalizados
- [x] Regularizar 10.351 acessos (10.349 contas novas e dois vínculos recuperados), preservando contas/senhas, preços, responsáveis e aprovação; novos códigos ERP usam criação limitada após gravação confirmada e retornam pendências ao monitor existente, sem polling ou alteração de scripts locais
- [x] 66 testes de acesso/lotes e 13 testes do monitor passaram; login real do 99306 pela tela, cadastro oficial aprovado e bloqueio da operação administrativa para cliente confirmados; funções implantadas, build OK
- [x] Manter códigos 4, 87371, 88888 e 8782 pendentes por decisão do usuário, sem senha alternativa nem desabilitar proteção; PROSPECT sem código ERP intocado

## Finalização iPhone/Safari DiColore
- [x] Auditar checkout/edição/portal/painel/pagamento/fila offline/gravação/exportação; correção do cliente preserva responsável salvo; pedidos concluídos e permissões intactos
- [x] Preservar destinatário por loja/conta/cliente, validar opções atuais e impedir perda de escolha em recargas
- [x] Evitar recarga por primeira leitura de versão, atualizar preços no checkout e abrir WhatsApp somente após pedido salvo, mantendo outras lojas
- [x] 112 testes passaram; conta 98596 autenticada em Chromium com agente iPhone: Grazi restaurada, alteração de preços bloqueia sem recarga, confirmação com uma aba após gravação simulada, cancelamento volta à DiColore; aviso não dispensável só DiColore; nenhum pedido/mensagem real enviado
- [ ] Confirmar salvamento real e passagem Safari/WhatsApp no iPhone físico — depende de pedido de teste autorizado e aparelho
- [ ] Disponibilizar correção e aviso obrigatório — depende de publicação

## Cadastro PROSPECT DiColore
- [x] Permitir cadastro sem CPF/CNPJ somente de prospect DiColore, mantendo check-in/check-out e regras das demais lojas
- [x] Conferir todos os dados ao finalizar; oferecer edição e voltar à finalização com cadastro salvo e carrinho preservado
- [x] 63 testes distintos passaram, incluindo cinco de gravação real com check-in/check-out; cadastro e edição na tela autenticada, documento/número persistidos e usados no envio interceptado, carrinho preservado e formulário móvel conferidos; registros temporários removidos, nenhum pedido liberado ao ERP

## Atualização por entrada DiColore
- [x] Reconsultar dados visíveis ao entrar, navegar e voltar de outro aplicativo, sem consultas periódicas novas e sem alterar outras lojas
- [x] Atualizar carteira ao abrir seleção, ler cadastro oficial antes de selecionar e revalidar financeiro/estoque na passagem ao carrinho
- [x] 40 testes passaram; sessão autenticada confirmou carteira, seleção 83658, estoque, retorno ao app e reentrada Vendas; financeiro real com 20 títulos pagos, retorno e celular sem overflow/erros; boleto não baixado pois esse cliente não tem títulos abertos
- [x] Preparar release com lista de avisos vazia, sem atualização obrigatória para esta melhoria; código antigo recebe os gatilhos somente depois de reabrir/recarregar
- [ ] Disponibilizar no site publicado — depende de publicação pelo usuário

## Navegação/WhatsApp web e preparação Android
- [x] Voltar do painel DiColore leva à loja; todas as cinco entradas de liberação oferecem WhatsApp somente após salvar, sem abas vazias e sem mudar outras lojas
- [x] 27 testes passaram; painel/portal autenticados em Chromium (celular com agente Firefox e computador), botão Agora não/Escape mantêm endereço e aba, link mantém #913; nenhuma liberação real nem envio de WhatsApp foi realizado
- [x] Configuração Capacitor com site publicado por padrão, prévia somente por opção explícita, dependências e guia ANDROID.md com configuração completa
- [ ] Confirmar liberação real e abertura/cancelamento no Firefox Android físico — depende de pedido de teste autorizado e aparelho; passagem navegador/WhatsApp não pode ser comprovada no Chromium do sandbox
- [ ] Compilar/assinar APK e testar WhatsApp/voltar no Android físico — depende de Android Studio, SDK e assinatura local

## Responsável pelo pedido DiColore
- [x] Atribuir/desvincular no Editar somente a admin/gerente, com gravação autorizada, autoria preservada e histórico
- [x] 27 testes passaram; atribuição/desvinculação e leitura na tela confirmadas em orçamento temporário, com valores/cadastro/pagamento intactos; gerente autorizado, vendedor/televendas e edição desatualizada bloqueados; celular sem overflow, sem erros; #904 consultado como Cancelado e intocado

## Ponto real do check-in DiColore
- [x] Gravar visita e ponto juntos, com autorização e endereço ERP preservado
- [x] Avisar fora do raio sem impedir confirmação; usar GPS atual em todas as entradas
- [x] 11 testes passaram; check-in real fora de 300 m sem justificativa, retorno a 0 m e endereço intocado confirmados na tela; cadastros temporários removidos; atualização só DiColore
- [ ] Conferir desenho do mapa no domínio publicado — chave Google Maps rejeita localhost; gravação e leitura das coordenadas verificadas

## Mapa SC — inteligência geográfica DiColore
- [x] Aba própria com ciclo de vida, filtros por vendedor/cidade/bairro e pontos agrupados por status predominante
- [x] 10.980 clientes SC na conta autorizada: 1.606 coordenadas cadastradas e 9.374 referências municipais aproximadas; sem envio de endereços a geocodificador
- [x] 21 testes passaram; mapa com 18 tiles carregados, filtros/status/bairros, gráficos, detalhes pelos agrupamentos e celular sem overflow/erros; build OK

## Ciclo de vida dos clientes DiColore
- [x] Resumo autorizado de dias de compra nos últimos 24 meses, carregado somente na nova aba
- [x] Frequência histórica/recente, recência, primeiras compras observadas e reativados, filtros por cidade/vendedor e exportação; ausência não comprova nunca comprou
- [x] 17 testes passaram; aba autenticada abriu sem alertas, filtro de frequência em queda, detalhe de compras e download Excel verificados; celular 390px sem overflow e sem erros; build OK

## Clientes recentes durante carga histórica
- [x] Abrir em 60 dias e limitar notas ao período atual/anterior; não classificar ausência parcial como nunca comprou
- [x] Consolidar mix em uma única leitura sob demanda, isolando falhas e mantendo exportação da carteira
- [x] 12 testes; abertura admin real em 7,2s, nenhuma consulta de mix na entrada; produtos/gráficos carregados sem alerta, Excel baixado e celular sem overflow; build OK

## Performance Atendimento e Clientes DiColore
- [x] Resumos históricos invoker preservam RLS; visitas/pedidos limitados ao período, sem baixar cabeçalhos de NF
- [x] Carteira em cache por 5 minutos, paginação paralela limitada a quatro leituras e gráficos diários calculados em uma passagem
- [x] 21 testes; sessão admin real, filtros de cobertura/busca, gráficos, Excel/PDF e celular sem overflow; retorno pelo menu 1,6–3,3s, primeira entrada 6,4–10,2s; build OK

## Supervisão de atendimento DiColore
- [x] Filtros de período/equipe, gráficos, cobertura, conversão por pedido/NF após visita e última visita
- [x] Metas por representante e prazo sem visita configuráveis por gerente/admin, com RPC exclusivo da DiColore
- [x] Dez testes passaram; entrada pelo menu e quatro abas em computador/celular, claro/escuro; períodos rápidos e intervalo A/B; paginação/exportação filtrada; metas 8 visitas/20 minutos salvas, relidas e revertidas a zero; sem erros

## Cliente e pedido no integrador externo DiColore
- [x] Incluir cadastro DW e clientes sem código ERP somente com integrador externo ativo
- [x] Confirmar código do cliente e pedido em gravação única, mantendo integração interna
- [x] Nove testes passaram; funções publicadas; API real bloqueia listagem/confirmação externa com opção NÃO e exige chave
- [ ] Confirmar transmissão cliente/pedido no ERP — opção atual está NÃO; depende de ativar SIM e executar o integrador do dev

## Identificação e recebimento DiColore
- [x] Identificar clientes sem desconto na lista e ocultar registro manual até habilitar recebimento PIX ou cartão, sem alterar outras lojas
- [x] 62 testes passaram; painel autenticado sem registro manual nos 20 pedidos visíveis e cliente 90818 identificado como “Não usa desconto”; tabela preservada confirmada no código e testes; texto do manual é consultivo

## Cliente sem desconto DiColore
- [x] Flag no cadastro, preservado nas sincronizações e protegido contra alteração pelo cliente
- [x] Usar somente preço da tabela no catálogo, carrinho, edição, impressão e pedidos bloqueados para desconto; preço oficial validado no banco
- [x] Botão Recalcular em orçamentos e pendentes não transmitidos, usando cadastro atual sem trocar número e autoria
- [x] 33 testes passaram; cadastro temporário marcado e salvo pelo painel; mesmo orçamento recalculado para R$59,80 com desconto zero e leitura confirmada; sem transmissão ao ERP

## Manual e liberação DiColore
- [x] Manual por loja com regras protegidas e opções de pagamento/WhatsApp; salvamento e leitura autenticados confirmados
- [x] Seleção rápida no painel/portal e confirmação do checkout; gravação única no mesmo pedido e trava de pagamento no banco
- [x] 34 testes passaram; painel autenticado abre campos no #717, bloqueia enquanto incompleto e habilita após seleção; computador e celular conferidos; build OK
- [ ] Confirmar gravação/liberação real e WhatsApp no portal e checkout — depende de pedido autorizado para transmissão; nenhum pedido real foi liberado no teste

## Navegação Clientes/Pedidos DiColore
- [x] Paginar somente DiColore em 25/50 clientes, mantendo busca em toda a base
- [x] Indexar cadastros dos pedidos mantendo a mesma resolução de identidade ERP; nove testes passaram
- [x] Verificar painel autenticado com 15.779 clientes: próxima página e busca JOICELI confirmadas; quatro trocas de abas em 280–353 ms, sem erros; build OK

## Localização e pagamento ERP DiColore
- [x] Traduzir IBGE na sincronização e recuperar cidade/UF de cadastros antigos pelo CEP no checkout, persistindo somente localização autorizada
- [x] Carregar forma e condição do cliente sem sobrescrever pedidos em edição
- [x] 65 testes passaram; funções publicadas; cliente 83658 com Jaraguá do Sul/SC e pagamento 4/58 confirmados no cadastro e checkout
- [x] Simulação autenticada chegou ao envio com status pendente e código 83658; gravação interceptada para não criar pedido nem notificação; sem opção de liberar
- [ ] Confirmar gravação e leitura de um pedido de teste — depende de autorização para criar pedido/notificações reais

## Finalização do cliente DiColore
- [x] Restaurar finalização do cliente como Pendente, sem opção de liberação
- [x] Substituir a trava de criação por proteção de status em inclusão e alteração; 22 testes passaram e alteração aplicada
- [x] Conferir abertura do checkout autenticado e registrar limite: carrinho vazio, sem gravação ou transmissão
- [ ] Confirmar finalização e tentativa de liberação pela conta de cliente — requer sessão de cliente e pedido de teste autorizado; caminho autenticado do cliente NÃO VERIFICADO

## Atualização obrigatória por loja
- [x] Corrigir detecção independente do sinal do navegador e acompanhar troca de loja
- [x] Exigir atualização da loja afetada sem apagar carrinho ou sessão
- [x] Testar detecção, direcionamento e atualização pela tela; 18 testes, computador/celular, JEWOS bloqueada por versão simulada, DiColore não interrompida, sem erros
- [ ] Confirmar entre duas versões publicadas no aplicativo instalado — depende de publicar; usuários com código anterior precisam de uma primeira atualização para carregar a nova detecção

## Baixa manual e recuperação de compra
- [x] Registrar pagamento manual com forma real e auditoria; manter trava do Bling; gravação e leitura pelo painel verificadas em orçamento temporário removido
- [x] Mostrar orientação fiel à recusa e recuperar carrinho sem duplicar cobrança; #732 consultado sem cancelamento; recuperação de pedido temporário verificada na tela
- [x] Restaurar Meus dados, senha e endereços fora da DiColore/SENSES; endereço temporário salvo e removido; bloqueio DiColore e celular verificados
- [x] Testar e publicar funções; 30 testes passaram; nenhuma cobrança real nem transmissão de teste

## Nova carga de clientes por vendedor
- [x] Aplicar tabela inicial por vendedor e preservar atribuições existentes no MPZ
- [x] Alinhar cadastros sem tabela dos demais vendedores; vendedor 28 recebe ERP na nova carga; 60 testes e chamada real sem gravações; função publicada
- [ ] Confirmar carga completa — depende de executar --tudo no servidor ERP

## Tabela de preço na sincronização de clientes
- [x] Normalizar tabelas de novos clientes, testar e publicar a correção no servidor (22 testes; chamada autenticada sem gravações)
- [ ] Confirmar carga dos clientes pendentes — depende do próximo ciclo do monitor no ERP

## Otimização da sincronização de clientes
- [x] Consultar somente clientes do lote e retirar criação de logins do envio ERP
- [x] Reduzir lotes para 250, adicionar tentativas e confirmar apenas registros sem erro
- [x] Testar, publicar a função e entregar monitor completo (13 testes; chamadas reais sem gravação e token inválido)
- [ ] Confirmar carga completa — depende de executar o monitor atualizado no servidor ERP

## Monitor de clientes pela dw_cliente
- [x] Ler public.dw_cliente sem alterar views e sem aceitar configuração antiga de mpz_cliente
- [x] Testar leitura, frete CIF/FOB e intervalo de 180 segundos; entregar código completo
- [ ] Confirmar execução real — depende de substituir e executar o monitor no servidor ERP do usuário

## Cadastro protegido DiColore e SENSES
- [x] Bloquear preenchimento e alteração de cadastro pelo cliente nas telas e na gravação
- [x] Usar cadastro oficial no pedido, mantendo acesso autorizado da equipe
- [x] Testar cinco regras de edição e direcionar aviso às duas lojas
- [ ] Confirmar pedido pela conta de um cliente dessas lojas — requer sessão desse cliente; não criar pedidos reais sem autorização

## Dados obrigatórios em todas as lojas
- [x] Exigir CPF/CNPJ válido, telefone com DDD e endereço completo no cadastro e pedido
- [x] Validar na gravação, preservar histórico e direcionar atualização a todas as lojas
- [x] Testar as regras e verificar bloqueio no checkout autenticado inclusive em retirada, sem criar pedidos

## Integração Super Frete JEWOS
- [x] Diagnosticar a rejeição do pedido #711 sem interromper o pedido ou o pagamento
- [x] Exigir os dados obrigatórios no checkout e preservar o detalhe dos erros do Super Frete
- [x] Validar três testes automatizados e o erro detalhado do #711 no painel autenticado
- [ ] Gerar a etiqueta do #711 após o admin informar o CPF/CNPJ no cadastro da cliente

## Finalização vendedor/televendas DiColore
- [x] Preservar forma e condição de pagamento ao editar (testes e restauração com resposta simulada)
- [x] Oferecer liberação desde a criação, mantendo clientes como pendente (regras testadas e confirmação simulada)
- [x] Disponibilizar PDF na confirmação; download verificado em desktop e visualização em celular
- [ ] Confirmar gravação e transmissão real por vendedor/televendas — requer pedido de teste autorizado para envio ao ERP

## Atualização do aplicativo instalado
- [x] Avisar quando uma nova versão estiver pronta e oferecer atualização no menu do vendedor
- [x] Validar detecção e preservação de carrinho/sessão com quatro testes e alerta no navegador
- [ ] Confirmar atualização entre versões no atalho instalado — depende de publicação e teste no celular

## Correção do monitor OF/NF v9
- [x] Preparar sincronização por dia, pedido individual, limites de tempo e atualização sem itens
- [x] Exibir progresso ao vivo no monitor e validar com seis testes automatizados
- [x] Entregar pacote de substituição e instruções
- [ ] Confirmar leitura do pedido 722199 e OF/NF na tela — depende de executar o pacote no servidor ERP do usuário

## Cadastro na transmissão DiColore
- [x] Priorizar cadastro pelo código transmitido e testar duplicados
- [x] Corrigir dados ausentes do pedido #524 e validar retorno real para o integrador (95773 / vendedor 46 / transportadora 175)
- [ ] Confirmar gravação do #524 no ERP — aguarda execução do monitor no servidor do usuário

- [ ] Criar e isolar a loja Mabelle com catálogo da DiColore
- [ ] Aplicar identidade e roteamento por domínio próprio
- [ ] Implementar cartão e Pix online em ambiente de teste
- [ ] Implementar cotação oficial dos Correios
- [ ] Validar loja, checkout e painel sem regressão na DiColore

## Força de Vendas DiColore
- [x] Motivo, observações e tempo total no registro de visitas
- [x] Botão Checkin/Checkout no Modo Vendedor com carteira do vendedor
- [x] Configurações no painel: período de não atendidos, distância máxima e motivos

## Financeiro ERP DiColore
- [x] Separar notas pelo representante da NF e corrigir acesso aos 8.496 itens históricos
- [x] Validar regras reais de vendedor/televendas/cliente, quatro testes e itens da NF 209426 no painel autenticado
- [x] Filtrar títulos por data mínima configurável de emissão ou vencimento sem apagar histórico
- [x] Autorizar títulos pelo código do cliente para cliente, vendedor da carteira, televendas e administrador
- [x] Integrar Notas Fiscais pela VIEW `dw_nota_fiscal` para cliente, vendedor, televendas e administrador
- Integração de pedidos MPZ -> ERP DiColore (Python): pendente teste no servidor

## Pagamento por cartão JEWOS
- [x] Bling só recebe pedidos com pagamento aprovado (automático e manual)
- [x] Gravar e exibir motivo da recusa do cartão (cliente e painel)
- [x] Cliente que desiste do pagamento: pedido cancelado e carrinho restaurado

## App DiColore: WhatsApp, vendedor, PDF e desempenho
- [x] WhatsApp abre pelo aplicativo instalado no APK, com link universal e copiar mensagem
- [x] Vendedor do checkout sempre em branco
- [x] Ver/Baixar PDF abre o documento na tela do APK
- [x] Carteira do vendedor filtrada no banco; lista completa em páginas paralelas
- [x] Títulos abrem em Abertos
- [x] Barra de carregamento no topo
- [ ] Confirmar WhatsApp e PDF no APK físico — depende de teste no aparelho após publicar
