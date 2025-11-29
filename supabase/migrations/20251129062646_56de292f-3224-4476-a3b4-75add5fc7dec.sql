-- Adicionar coluna para parceria padrão na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN default_partnership_id uuid REFERENCES public.partnerships(id) ON DELETE SET NULL;