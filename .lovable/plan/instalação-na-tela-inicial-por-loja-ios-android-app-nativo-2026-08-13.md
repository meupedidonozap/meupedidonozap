# Instalação na tela inicial por loja (iOS/Android) + app nativo

## Problema atual
O app tem um único manifesto fixo com `start_url: "/"`. Por isso, ao usar "Adicionar à Tela de Início" em qualquer página (inclusive `/dicoloresenses/admin`), o ícone criado sempre abre a tela de escolha de loja — nunca a loja ou o painel.

## O que será feito

### 1. Manifesto dinâmico por contexto
Um componente injeta, em tempo de execução, um manifesto próprio conforme a página aberta:

- Em `/:slug` → abre direto a vitrine da loja.
- Em `/:slug/admin` → abre direto o painel administrativo daquela loja.
- Nome e nome curto usam o nome da loja (ex.: "DiColore Senses — Admin").
- `display: standalone`, cores do tema e ícones da loja (logo quando existir, senão o ícone padrão).

Isso vale para todas as lojas, então DiColore e DiColore Senses passam a se comportar igual.

### 2. Suporte específico do iPhone
Adicionar as tags que o Safari exige para o atalho virar "app": `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title` e `apple-mobile-web-app-status-bar-style`, também dinâmicos por loja.

### 3. Aviso de instalação
No painel da loja, junto ao card de notificações, mostrar uma instrução curta quando o app ainda não estiver instalado:
- iPhone: Compartilhar → Adicionar à Tela de Início.
- Android: menu do navegador → Instalar aplicativo (ou botão "Instalar" quando o navegador oferecer o prompt).

Observação importante: no iPhone, as notificações push só funcionam com o app já instalado na tela de início e aberto por esse ícone. O card de notificações passa a explicar isso quando detectar iOS fora do modo instalado.

### 4. Reinstalação necessária
Quem já adicionou o atalho antigo precisa apagar o ícone e adicionar de novo pela página desejada — o iOS/Android guarda o `start_url` do momento da instalação.

## Sobre gerar APK / app da App Store
O que existe hoje é um app web instalável (PWA), que cobre iPhone e Android sem loja de aplicativos. Para ter arquivo APK (Android) e build para App Store (iOS) é necessário empacotar com Capacitor: exportar o projeto para o GitHub, rodar o build localmente com Android Studio (APK) e Xcode em um Mac (iOS), e publicar nas lojas com contas de desenvolvedor (Google Play: taxa única; Apple: anual). Isso é um segundo passo, separado deste plano — posso executá-lo depois se quiser.

## Detalhes técnicos
- Novo componente `src/components/DynamicManifest.tsx`: monta o JSON do manifesto, cria um Blob URL e substitui `<link rel="manifest">`, além das metas Apple; usado em `StorePage`, `StoreAdminPage` e nas demais páginas de loja.
- `vite.config.ts`: manifesto do plugin PWA permanece como fallback genérico da plataforma.
- Novo `src/components/InstallAppCard.tsx`: captura `beforeinstallprompt` (Android/Chrome) e mostra as instruções de iOS via detecção de `navigator.standalone` / `display-mode: standalone`.
- Sem mudanças de banco de dados nem de service worker; o push continua usando o worker atual.
