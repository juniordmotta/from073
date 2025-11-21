-- Criar tabela de custos operacionais
CREATE TABLE public.operational_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem criar seus próprios custos"
ON public.operational_costs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Operadores veem apenas seus custos"
ON public.operational_costs
FOR SELECT
USING (
  (auth.uid() = user_id) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]))
);

CREATE POLICY "Usuários podem atualizar seus próprios custos"
ON public.operational_costs
FOR UPDATE
USING (
  (auth.uid() = user_id) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]))
);

CREATE POLICY "Usuários podem deletar seus próprios custos"
ON public.operational_costs
FOR DELETE
USING (
  (auth.uid() = user_id) OR 
  (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]))
);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_operational_costs_updated_at
BEFORE UPDATE ON public.operational_costs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();