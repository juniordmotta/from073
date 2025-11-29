-- Create partnerships table
CREATE TABLE public.partnerships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL,
  endereco TEXT NOT NULL,
  valor_banca NUMERIC(10, 2) NOT NULL,
  bancos_cadastrados TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ativo', 'inativo')) DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for partnerships
CREATE POLICY "Usuários podem ver suas próprias parcerias"
ON public.partnerships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as parcerias"
ON public.partnerships
FOR SELECT
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

CREATE POLICY "Usuários podem criar suas próprias parcerias"
ON public.partnerships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias parcerias"
ON public.partnerships
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias parcerias"
ON public.partnerships
FOR DELETE
USING (auth.uid() = user_id);

-- Add partnership references to arbitrages table
ALTER TABLE public.arbitrages
ADD COLUMN casa_01_parceria_id UUID REFERENCES public.partnerships(id),
ADD COLUMN casa_02_parceria_id UUID REFERENCES public.partnerships(id),
ADD COLUMN casa_03_parceria_id UUID REFERENCES public.partnerships(id);

-- Create trigger for updated_at
CREATE TRIGGER update_partnerships_updated_at
BEFORE UPDATE ON public.partnerships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();