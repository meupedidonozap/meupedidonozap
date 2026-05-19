ALTER TABLE public.store_users
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'auxiliar';

ALTER TABLE public.store_users
  DROP CONSTRAINT IF EXISTS store_users_role_check;

ALTER TABLE public.store_users
  ADD CONSTRAINT store_users_role_check
  CHECK (role IN ('auxiliar','vendedor','televendas'));