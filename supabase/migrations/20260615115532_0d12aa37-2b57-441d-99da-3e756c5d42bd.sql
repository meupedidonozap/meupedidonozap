drop trigger if exists trg_notify_new_pending_order on public.orders;
create trigger trg_notify_new_pending_order
  after insert on public.orders
  for each row execute function public.notify_new_pending_order();

drop trigger if exists trg_notify_status_pending on public.orders;
create trigger trg_notify_status_pending
  after update of status on public.orders
  for each row
  when (new.status in ('pendente','pending') and old.status is distinct from new.status)
  execute function public.notify_new_pending_order();