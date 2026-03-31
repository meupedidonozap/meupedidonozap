

# Adicionar nova meta tag de verificação do Google

## Mudança

**Arquivo:** `index.html` (linha 10)

Adicionar a nova meta tag `google-site-verification` ao lado da existente. Manter a antiga caso seja de outra propriedade.

**Antes (linha 10):**
```html
<meta name="google-site-verification" content="d9LrNQlZ83iCH60VYDv5sn2w9oPJywY0THKr3L74meM" />
```

**Depois (linhas 10-11):**
```html
<meta name="google-site-verification" content="d9LrNQlZ83iCH60VYDv5sn2w9oPJywY0THKr3L74meM" />
<meta name="google-site-verification" content="3Ymv1yibwdBxZGzHcVPV0nLN7NxZWDQ9uO1rp1gDYus" />
```

Após o deploy, voltar ao Google Search Console e clicar em "Verificar".

