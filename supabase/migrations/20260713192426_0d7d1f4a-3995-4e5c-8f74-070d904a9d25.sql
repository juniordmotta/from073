
-- Add WITH CHECK to UPDATE policies
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias arbitragens" ON public.arbitrages;
CREATE POLICY "Usuários podem atualizar suas próprias arbitragens"
ON public.arbitrages FOR UPDATE
USING ((auth.uid() = user_id) OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role])))
WITH CHECK ((auth.uid() = user_id) OR (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role])));

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios bancos" ON public.banks;
CREATE POLICY "Usuários podem atualizar seus próprios bancos"
ON public.banks FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias metas" ON public.monthly_goals;
CREATE POLICY "Usuários podem atualizar suas próprias metas"
ON public.monthly_goals FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias categorias" ON public.note_categories;
CREATE POLICY "Usuários podem atualizar suas próprias categorias"
ON public.note_categories FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias anotações" ON public.notes;
CREATE POLICY "Usuários podem atualizar suas próprias anotações"
ON public.notes FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários e admins podem atualizar parcerias" ON public.partnerships;
CREATE POLICY "Usuários e admins podem atualizar parcerias"
ON public.partnerships FOR UPDATE
USING ((auth.uid() = user_id) OR (get_user_role(auth.uid()) = 'admin_master'::user_role))
WITH CHECK ((auth.uid() = user_id) OR (get_user_role(auth.uid()) = 'admin_master'::user_role));

-- Revoke EXECUTE on trigger-only SECURITY DEFINER functions from client roles
REVOKE EXECUTE ON FUNCTION public.log_role_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_banks_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_custom_group_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_hidden_house_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_monthly_goals_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_custom_house_event() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_partnership_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_arbitrage_result_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_profile_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_goal_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_partnership_references() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_lucro_real() FROM PUBLIC, anon, authenticated;
