CREATE OR REPLACE FUNCTION public.notify_new_pending_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_url text := 'https://buvhdqpbpbwpzidzmdqh.supabase.co/functions/v1/notify-new-order';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1dmhkcXBicGJ3cHppZHptZHFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MjkxNjAsImV4cCI6MjA4NjMwNTE2MH0.-9GJg347r5JKvbRwNTd2RnOmIgi99KTN1xMl46WJ6mg';
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

DROP TRIGGER IF EXISTS trg_notify_new_pending_order ON public.orders;
CREATE TRIGGER trg_notify_new_pending_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_pending_order();