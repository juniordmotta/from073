-- Criar tabela de bancos
CREATE TABLE IF NOT EXISTS public.banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS para bancos
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para bancos
CREATE POLICY "Usuários podem ver seus próprios bancos"
  ON public.banks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios bancos"
  ON public.banks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios bancos"
  ON public.banks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios bancos"
  ON public.banks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todos os bancos"
  ON public.banks FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Criar tabela de metas mensais
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  partnership_id UUID REFERENCES public.partnerships(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- Primeiro dia do mês
  goal_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, partnership_id, month)
);

-- Habilitar RLS para metas
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para metas
CREATE POLICY "Usuários podem ver suas próprias metas"
  ON public.monthly_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias metas"
  ON public.monthly_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias metas"
  ON public.monthly_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias metas"
  ON public.monthly_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as metas"
  ON public.monthly_goals FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Criar tabela de relação entre parcerias e bancos
CREATE TABLE IF NOT EXISTS public.partnership_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  bank_id UUID NOT NULL REFERENCES public.banks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(partnership_id, bank_id)
);

-- Habilitar RLS para partnership_banks
ALTER TABLE public.partnership_banks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para partnership_banks
CREATE POLICY "Usuários podem ver bancos de suas parcerias"
  ON public.partnership_banks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.partnerships 
    WHERE partnerships.id = partnership_banks.partnership_id 
    AND partnerships.user_id = auth.uid()
  ));

CREATE POLICY "Usuários podem adicionar bancos às suas parcerias"
  ON public.partnership_banks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.partnerships 
    WHERE partnerships.id = partnership_banks.partnership_id 
    AND partnerships.user_id = auth.uid()
  ));

CREATE POLICY "Usuários podem remover bancos de suas parcerias"
  ON public.partnership_banks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.partnerships 
    WHERE partnerships.id = partnership_banks.partnership_id 
    AND partnerships.user_id = auth.uid()
  ));

CREATE POLICY "Admins podem ver todos os bancos de parcerias"
  ON public.partnership_banks FOR SELECT
  USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

-- Trigger para atualizar updated_at em banks
CREATE OR REPLACE FUNCTION update_banks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_banks_updated_at_trigger
  BEFORE UPDATE ON public.banks
  FOR EACH ROW
  EXECUTE FUNCTION update_banks_updated_at();

-- Trigger para atualizar updated_at em monthly_goals
CREATE OR REPLACE FUNCTION update_monthly_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_goals_updated_at_trigger
  BEFORE UPDATE ON public.monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_goals_updated_at();