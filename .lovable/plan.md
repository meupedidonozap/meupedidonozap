

# Corrigir erro 404 ao compartilhar links (Netlify SPA Routing)

## Problema
Quando alguem acessa diretamente uma URL como `meupedidonozap.online/lfstore`, o Netlify tenta encontrar um arquivo nesse caminho. Como nao existe, retorna 404. Isso acontece porque o projeto e uma Single Page Application (SPA) -- todas as rotas sao gerenciadas pelo React Router no navegador, nao no servidor.

## Solucao
Criar um arquivo de redirecionamento do Netlify que envia todas as requisicoes para o `index.html`, permitindo que o React Router resolva a rota corretamente.

## O que sera feito
Criar o arquivo `public/_redirects` com o conteudo:

```text
/*    /index.html   200
```

Isso instrui o Netlify a servir o `index.html` para qualquer rota, sem retornar 404. O React Router entao cuida de exibir a pagina correta (`/:slug`, `/:slug/admin`, etc.).

## Observacao
Se voce estiver usando a URL publicada pelo Lovable (`meupedidonozap.lovable.app`), esse redirecionamento ja e tratado automaticamente. O arquivo `_redirects` e necessario apenas para deploy no Netlify.
