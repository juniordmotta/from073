-- Criar tabela para armazenar casas de apostas customizadas/editadas
CREATE TABLE public.custom_betting_houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_house_id TEXT, -- NULL se for casa nova, ID se for edição
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, name)
);

-- Habilitar RLS
ALTER TABLE public.custom_betting_houses ENABLE ROW LEVEL SECURITY;

-- Todos podem ver casas customizadas
CREATE POLICY "Todos podem ver casas customizadas"
ON public.custom_betting_houses FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Apenas admins podem criar casas
CREATE POLICY "Admins podem criar casas"
ON public.custom_betting_houses FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Apenas admins podem atualizar casas
CREATE POLICY "Admins podem atualizar casas"
ON public.custom_betting_houses FOR UPDATE
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Apenas admins podem deletar casas
CREATE POLICY "Admins podem deletar casas"
ON public.custom_betting_houses FOR DELETE
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_custom_betting_houses_updated_at
BEFORE UPDATE ON public.custom_betting_houses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();