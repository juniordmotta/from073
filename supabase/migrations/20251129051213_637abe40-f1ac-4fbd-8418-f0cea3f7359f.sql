-- Corrigir search_path nas funções trigger
DROP FUNCTION IF EXISTS update_banks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_monthly_goals_updated_at() CASCADE;

CREATE OR REPLACE FUNCTION update_banks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_banks_updated_at_trigger
  BEFORE UPDATE ON public.banks
  FOR EACH ROW
  EXECUTE FUNCTION update_banks_updated_at();

CREATE OR REPLACE FUNCTION update_monthly_goals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_monthly_goals_updated_at_trigger
  BEFORE UPDATE ON public.monthly_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_goals_updated_at();