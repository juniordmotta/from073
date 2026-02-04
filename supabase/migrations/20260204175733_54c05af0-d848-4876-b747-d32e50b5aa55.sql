
-- Remover política atual de DELETE
DROP POLICY IF EXISTS "Admins podem deletar arbitragens" ON public.arbitrages;

-- Criar nova política que permite operadores deletarem suas próprias arbitragens
CREATE POLICY "Usuários podem deletar suas próprias arbitragens"
ON public.arbitrages
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role])
);
