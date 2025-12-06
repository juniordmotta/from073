-- Atualizar o check constraint para incluir aguardando_verificacao
ALTER TABLE public.partnership_houses DROP CONSTRAINT IF EXISTS partnership_houses_status_check;

ALTER TABLE public.partnership_houses ADD CONSTRAINT partnership_houses_status_check 
CHECK (status IN ('ativa', 'bloqueada', 'sacar', 'aguardando_pagamento', 'aguardando_verificacao'));

-- Permitir exclusão em cascata - primeiro remove as referências nas arbitrages antes de deletar parcerias
-- Criar função para limpar referências de arbitrages antes de deletar parceria
CREATE OR REPLACE FUNCTION public.clear_partnership_references()
RETURNS TRIGGER AS $$
BEGIN
  -- Limpar referências na tabela arbitrages
  UPDATE public.arbitrages 
  SET casa_01_parceria_id = NULL 
  WHERE casa_01_parceria_id = OLD.id;
  
  UPDATE public.arbitrages 
  SET casa_02_parceria_id = NULL 
  WHERE casa_02_parceria_id = OLD.id;
  
  UPDATE public.arbitrages 
  SET casa_03_parceria_id = NULL 
  WHERE casa_03_parceria_id = OLD.id;
  
  -- Deletar casas relacionadas
  DELETE FROM public.partnership_houses WHERE partnership_id = OLD.id;
  
  -- Deletar bancos relacionados
  DELETE FROM public.partnership_banks WHERE partnership_id = OLD.id;
  
  -- Deletar metas relacionadas
  DELETE FROM public.monthly_goals WHERE partnership_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para limpar antes de deletar
DROP TRIGGER IF EXISTS clear_partnership_refs_trigger ON public.partnerships;
CREATE TRIGGER clear_partnership_refs_trigger
BEFORE DELETE ON public.partnerships
FOR EACH ROW
EXECUTE FUNCTION public.clear_partnership_references();