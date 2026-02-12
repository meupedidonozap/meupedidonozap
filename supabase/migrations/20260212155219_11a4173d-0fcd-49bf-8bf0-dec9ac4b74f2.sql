
-- Create store_admins table
CREATE TABLE public.store_admins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

-- Enable RLS
ALTER TABLE public.store_admins ENABLE ROW LEVEL SECURITY;

-- Security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_store_admin(_user_id UUID, _store_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.store_admins
    WHERE user_id = _user_id AND store_id = _store_id
  )
$$;

-- RLS policies for store_admins
CREATE POLICY "Anyone can read store_admins" ON public.store_admins
FOR SELECT USING (true);

CREATE POLICY "Allow insert store_admins" ON public.store_admins
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete store_admins" ON public.store_admins
FOR DELETE USING (true);
