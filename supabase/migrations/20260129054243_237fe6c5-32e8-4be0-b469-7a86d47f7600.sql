-- Criar tabela de grupos customizados de casas de apostas
CREATE TABLE public.custom_betting_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by uuid NOT NULL,
  nome text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.custom_betting_groups ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Todos podem ver grupos customizados"
  ON public.custom_betting_groups FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem criar grupos"
  ON public.custom_betting_groups FOR INSERT
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

CREATE POLICY "Admins podem atualizar grupos"
  ON public.custom_betting_groups FOR UPDATE
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

CREATE POLICY "Admins podem deletar grupos"
  ON public.custom_betting_groups FOR DELETE
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

-- Trigger para updated_at
CREATE TRIGGER update_custom_betting_groups_updated_at
  BEFORE UPDATE ON public.custom_betting_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();