-- Atualizar política de DELETE para permitir que admin_master delete parcerias de outros usuários
DROP POLICY IF EXISTS "Usuários podem deletar suas próprias parcerias" ON public.partnerships;

CREATE POLICY "Usuários e admins podem deletar parcerias"
ON public.partnerships
FOR DELETE
USING (
  auth.uid() = user_id OR 
  get_user_role(auth.uid()) = 'admin_master'::user_role
);

-- Adicionar novo status para casas adicionadas manualmente
-- Atualizar também a política para permitir admin_master atualizar parcerias de outros
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias parcerias" ON public.partnerships;

CREATE POLICY "Usuários e admins podem atualizar parcerias"
ON public.partnerships
FOR UPDATE
USING (
  auth.uid() = user_id OR 
  get_user_role(auth.uid()) = 'admin_master'::user_role
);