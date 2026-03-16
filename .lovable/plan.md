# Integração com Google Merchant Center

## O que o Google Merchant Center precisa

O screenshot mostra que o Google está pedindo **verificação e reivindicação do site**. Isso é um pré-requisito antes de enviar produtos.

## O que podemos fazer no Lovable

### 1. Verificação do site via meta tag HTML

Adicionar a meta tag de verificação do Google no `index.html`. O Google fornece uma tag como:

```html
<meta name="google-site-verification" content="4KKTFhZo_9RnZXOY95JmhkNgbZeeYxdv4btpYvNUoC8" />
```

Você precisa copiar esse código da interface do Google Merchant Center (opção "verificar usando uma tag HTML").

### 2. Dados estruturados (Schema.org) nos produtos

Adicionar markup JSON-LD de `Product` nas páginas de produto para que o Google reconheça os produtos automaticamente. Isso inclui nome, descrição, preço, imagem, disponibilidade.

### 3. Sitemap básico

Criar um sitemap para facilitar a indexação dos produtos pelo Google.

## O que **NÃO** é possível fazer no Lovable

- **Feed de produtos XML/CSV**: O Google Merchant Center normalmente precisa de um feed estruturado (XML ou CSV) com todos os produtos. Isso requer uma edge function que gere o feed dinamicamente a partir do banco de dados.
- **API do Merchant Center**: Não temos conector para a API do Google Merchant Center.

## Plano de implementação

### Etapa 1: Meta tag de verificação do Google

- Você precisa ir no Google Merchant Center, escolher "Verificar usando tag HTML" e copiar o código
- Eu adiciono a tag no `index.html`

### Etapa 2: Edge function para gerar feed de produtos

- Criar uma edge function `/google-product-feed` que consulta os produtos ativos da loja Rafa's e retorna um XML no formato Merchant Center (RSS 2.0 com namespace `g:`)
- A URL do feed será algo como `https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/google-product-feed?store=rafasmanutencaoresidencial`
- Esse feed pode ser cadastrado manualmente no Merchant Center

### Etapa 3: Dados estruturados nas páginas de produto (opcional)

- Adicionar JSON-LD `Product` schema na vitrine para SEO e integração direta

## Próximo passo necessário

Preciso que você vá no Google Merchant Center e copie o **código da meta tag de verificação HTML**. Sem isso, não consigo avançar com a verificação do site.