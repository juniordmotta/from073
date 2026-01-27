-- Criar tabela para rastrear casas de apostas ocultas/removidas do catálogo
CREATE TABLE public.hidden_betting_houses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id TEXT NOT NULL,
  house_name TEXT NOT NULL,
  group_id TEXT NOT NULL,
  hidden_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(house_id)
);

-- Habilitar RLS
ALTER TABLE public.hidden_betting_houses ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver casas ocultas
CREATE POLICY "Admins podem ver casas ocultas"
ON public.hidden_betting_houses FOR SELECT
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Apenas admins podem ocultar casas
CREATE POLICY "Admins podem ocultar casas"
ON public.hidden_betting_houses FOR INSERT
WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Apenas admins podem restaurar casas (deletar da tabela de ocultas)
CREATE POLICY "Admins podem restaurar casas"
ON public.hidden_betting_houses FOR DELETE
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));