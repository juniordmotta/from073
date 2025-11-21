-- Primeiro, vamos garantir que o trigger existe e está correto
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recriar a função do trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Verifica se é o primeiro usuário
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1) INTO is_first_user;
  
  -- Insere o perfil
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  
  -- Insere a role
  IF is_first_user THEN
    -- Primeiro usuário é admin_master
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin_master');
  ELSE
    -- Demais usuários são operadores por padrão
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'operador');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Corrigir o usuário que foi criado sem profile/role
INSERT INTO public.profiles (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', 'Adriano Oliveira')
FROM auth.users
WHERE id = '05abb2d5-3edb-4838-b142-3db6efa9cb3d'
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.user_roles (user_id, role)
VALUES ('05abb2d5-3edb-4838-b142-3db6efa9cb3d', 'operador')
ON CONFLICT (user_id) DO NOTHING;