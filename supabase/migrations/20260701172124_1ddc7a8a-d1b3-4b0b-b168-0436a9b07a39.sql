
-- 1. Drop permissive INSERT policies on history tables
DROP POLICY IF EXISTS "Sistema pode inserir no histórico de usuários" ON public.users_history;
DROP POLICY IF EXISTS "Sistema pode inserir histórico" ON public.partnerships_history;
DROP POLICY IF EXISTS "Usuários autenticados podem criar histórico" ON public.arbitrage_history;

-- No replacement INSERT policies: history rows are inserted exclusively by
-- SECURITY DEFINER triggers (owned by postgres, which bypasses RLS) or by
-- the service_role. Client-side inserts are now blocked.

-- 2. Ensure arbitrage_history gets populated safely via a trigger
CREATE OR REPLACE FUNCTION public.log_arbitrage_result_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.casa_01_resultado IS DISTINCT FROM NEW.casa_01_resultado THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_01_nome, OLD.casa_01_resultado, NEW.casa_01_resultado);
  END IF;
  IF OLD.casa_02_resultado IS DISTINCT FROM NEW.casa_02_resultado THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_02_nome, OLD.casa_02_resultado, NEW.casa_02_resultado);
  END IF;
  IF OLD.casa_03_resultado IS DISTINCT FROM NEW.casa_03_resultado AND NEW.casa_03_nome IS NOT NULL THEN
    INSERT INTO public.arbitrage_history (arbitrage_id, user_id, casa, resultado_anterior, resultado_novo)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), NEW.casa_03_nome, OLD.casa_03_resultado, NEW.casa_03_resultado);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_arbitrage_result_changes_trigger ON public.arbitrages;
CREATE TRIGGER log_arbitrage_result_changes_trigger
AFTER UPDATE ON public.arbitrages
FOR EACH ROW
EXECUTE FUNCTION public.log_arbitrage_result_changes();

-- 3. Revoke EXECUTE on internal SECURITY DEFINER functions from public/anon.
-- These are trigger functions or helpers not meant to be called from the API.
REVOKE ALL ON FUNCTION public.log_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_hidden_house_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_custom_group_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_banks_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_monthly_goals_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_goal_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_custom_house_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_partnership_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_partnership_references() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_lucro_real() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_user_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_arbitrage_result_changes() FROM PUBLIC, anon, authenticated;

-- get_user_role must remain executable by authenticated because it is
-- referenced inside RLS policies; revoke only from anon and public.
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
