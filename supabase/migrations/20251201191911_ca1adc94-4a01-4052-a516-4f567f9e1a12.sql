-- Create table for partnership house statuses
CREATE TABLE IF NOT EXISTS public.partnership_houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  house_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'bloqueada', 'sacar', 'aguardando_pagamento')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(partnership_id, house_name)
);

-- Enable RLS
ALTER TABLE public.partnership_houses ENABLE ROW LEVEL SECURITY;

-- Users can view house statuses for their own partnerships
CREATE POLICY "Usuários podem ver status das casas de suas parcerias"
  ON public.partnership_houses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships
      WHERE partnerships.id = partnership_houses.partnership_id
      AND partnerships.user_id = auth.uid()
    )
  );

-- Admins can view all house statuses
CREATE POLICY "Admins podem ver todos os status das casas"
  ON public.partnership_houses
  FOR SELECT
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

-- Users can insert house statuses for their own partnerships
CREATE POLICY "Usuários podem criar status das casas para suas parcerias"
  ON public.partnership_houses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partnerships
      WHERE partnerships.id = partnership_houses.partnership_id
      AND partnerships.user_id = auth.uid()
    )
  );

-- Users can update house statuses for their own partnerships
CREATE POLICY "Usuários podem atualizar status das casas de suas parcerias"
  ON public.partnership_houses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships
      WHERE partnerships.id = partnership_houses.partnership_id
      AND partnerships.user_id = auth.uid()
    )
  );

-- Users can delete house statuses for their own partnerships
CREATE POLICY "Usuários podem deletar status das casas de suas parcerias"
  ON public.partnership_houses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.partnerships
      WHERE partnerships.id = partnership_houses.partnership_id
      AND partnerships.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_partnership_houses_updated_at
  BEFORE UPDATE ON public.partnership_houses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();