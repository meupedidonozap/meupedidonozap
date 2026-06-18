DROP TRIGGER IF EXISTS trg_notify_new_pending_order ON public.orders;
CREATE TRIGGER trg_notify_new_pending_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_pending_order();