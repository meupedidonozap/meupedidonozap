# Meu Pedido no Zap — preparação Android

## Situação

As dependências e a configuração do Capacitor estão prontas. Não há APK compilado ou assinado nesta entrega. Android Studio, SDK Android e a chave de assinatura devem estar disponíveis na máquina que gerar o aplicativo. O aplicativo usa a versão publicada do MPZ e precisa de internet; não há novo modo offline. Login e permissões por loja permanecem obrigatórios.

Os ajustes web foram conferidos com sessão autorizada, em computador e celular simulado: cancelar a confirmação mantém a loja aberta e não cria abas. O link preserva o destinatário e o número do pedido. Não foi liberado nenhum pedido real nem enviada mensagem; o Firefox Android físico e a abertura do WhatsApp instalado ainda precisam ser testados. Cancelar apenas a mensagem não desfaz a liberação já salva do pedido.

O domínio publicado configurado é o domínio principal informado pelo projeto. Antes de distribuir, confirme o domínio oficial usado pela equipe: sessões de navegador em outro domínio não são transferidas para o aplicativo, e será necessário fazer login novamente.

## Arquivo completo para copiar

Caminho exato no projeto: `capacitor.config.ts`

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.dfc9e1d2017c4c4499328af8ac12f08f',
  appName: 'meupedidonozap',
  webDir: 'dist',
  // Online shell: published site keeps existing store-specific updates working.
  // Development preview is opt-in and must never be used for distribution.
  server: process.env.MPZ_MOBILE_LIVE_PREVIEW === '1' ? {
    url: 'https://dfc9e1d2-017c-4c44-9932-8af8ac12f08f.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  } : {
    url: 'https://meupedidonozap.lovable.app',
    cleartext: false,
  },
};

export default config;
```

## Gerar e testar no computador

1. Publique os ajustes web e obtenha a versão mais recente do projeto pelo repositório conectado ao Lovable. Use Node.js 22 ou superior, Android Studio compatível com Capacitor 8, SDK Android 36 e o Java recomendado pelo Android Studio.
2. Na pasta do projeto, execute os comandos abaixo. Adicione Android apenas na primeira vez.

```text
npm install
npx cap add android
npx cap update android
npm run build
npx cap sync android
npx cap open android
```

3. No Android Studio, selecione um emulador ou celular com depuração USB e execute o aplicativo. Alternativamente, depois da configuração do dispositivo, use `npx cap run android`.
4. Para distribuição à equipe, use **Build > Generate Signed App Bundle or APK > APK** e crie/guarde a chave de assinatura fora do projeto. Não envie senha ou chave no chat nem as inclua no repositório. Um APK de depuração não substitui o APK assinado de distribuição.
5. Para Google Play, gere um AAB assinado; publicação e aprovação são etapas separadas.

Após cada mudança: atualize primeiro o código local pelo repositório conectado, execute `npm install` se as dependências mudaram, `npm run build` e `npx cap sync`. Atualizações de capacidades nativas exigem recompilar o aplicativo. Atualizações web vêm do site publicado, usando o aviso de versão por loja já existente.

Não configure `allowNavigation` com `*`: destinos externos não devem executar dentro da janela autenticada do aplicativo.

## Prévia de desenvolvimento — não distribuir

Somente para desenvolvimento, ative `MPZ_MOBILE_LIVE_PREVIEW=1` antes de sincronizar. No PowerShell:

```powershell
$env:MPZ_MOBILE_LIVE_PREVIEW = '1'
npx cap sync android
```

Antes de gerar uma versão para a equipe, remova a variável e sincronize novamente:

```powershell
Remove-Item Env:MPZ_MOBILE_LIVE_PREVIEW -ErrorAction SilentlyContinue
npm run build
npx cap sync android
```

Confirme no Android Studio que `android/app/src/main/assets/capacitor.config.json` aponta para o site publicado, não para a prévia.

## Validação obrigatória no celular

- Login de vendedor e televendas e acesso somente ao permitido.
- Liberação de pedido de teste autorizado e leitura do status ao retornar.
- Abertura do WhatsApp; cancelar no Android e voltar ao mesmo pedido sem sair da conta.
- WhatsApp não instalado: aviso e opção de copiar a mensagem.
- Botão Voltar físico, reabertura do aplicativo e retomada da sessão.
- GPS/check-in e suas permissões: ainda não validados no APK; a preparação não garante melhorias de precisão.
- Sem alteração de pedidos reais durante testes não autorizados.

## Leitura recomendada

Leia este [artigo sobre converter um projeto Lovable em aplicativo com Capacitor](https://capawesome.io/blog/convert-lovable-app-to-mobile-app/) e a [documentação oficial Android](https://capacitorjs.com/docs/android). Serviços de compilação em nuvem citados no artigo são opcionais e não foram contratados nem configurados.