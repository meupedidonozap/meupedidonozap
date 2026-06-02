## Correção

Criar uma nova migration que substitui a função `public.notify_new_pending_order()` para:

1. Usar a assinatura correta do pg_net: `net.http_post(url := ..., body := jsonb, headers := jsonb)`.
2. Envolver a chamada em `BEGIN/EXCEPTION WHEN OTHERS THEN ... END` para que qualquer falha futura no disparo da notificação **nunca** quebre o INSERT do pedido (apenas registra `RAISE WARNING`).
3. Manter `SET search_path = public, extensions, net` e o filtro `status IN ('pendente','pending')`.

```sql
CREATE OR REPLACE FUNCTION public.notify_new_pending_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_url text := 'https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/notify-new-order';
  v_anon text := '...anon...';
BEGIN
  IF NEW.status IN ('pendente','pending') THEN
    BEGIN
      PERFORM net.http_post(
        url := v_url,
        body := jsonb_build_object('order_id', NEW.id),
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'apikey', v_anon,
          'Authorization','Bearer '||v_anon
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_new_pending_order falhou: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
```

Sem mudanças no frontend ou na edge function. Após aplicar, o botão **Enviar Pedido** da Mesa volta a funcionar imediatamente; as notificações push continuam funcionando assim que os secrets VAPID forem configurados.