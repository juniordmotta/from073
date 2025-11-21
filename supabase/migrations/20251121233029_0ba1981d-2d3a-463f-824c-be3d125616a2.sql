-- Corrigir política RLS do profiles para prevenir hijacking de ID
DROP POLICY IF EXISTS "Usuários podem atualizar seu próprio perfil" ON public.profiles;

CREATE POLICY "Usuários podem atualizar seu próprio perfil"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Adicionar política para deleção de usuários (apenas admin_master pode deletar profiles)
CREATE POLICY "Admin Master pode deletar perfis"
ON public.profiles
FOR DELETE
USING (get_user_role(auth.uid()) = 'admin_master'::user_role);