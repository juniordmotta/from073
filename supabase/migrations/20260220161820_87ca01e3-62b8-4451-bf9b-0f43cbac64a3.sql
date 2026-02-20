-- Drop the old restrictive UPDATE policy
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

-- Create new policy: users can update their own profile OR admin_master can update any profile
CREATE POLICY "Usuários e admin_master podem atualizar perfis"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR get_user_role(auth.uid()) = 'admin_master'::user_role)
WITH CHECK (auth.uid() = id OR get_user_role(auth.uid()) = 'admin_master'::user_role);