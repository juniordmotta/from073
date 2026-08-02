-- 1) Harden get_user_role: only the caller's own role, unless caller is admin
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_role public.user_role;
BEGIN
  -- Called outside a request context (triggers/service role): keep original behaviour
  IF caller IS NULL THEN
    RETURN (SELECT role FROM public.user_roles WHERE user_id = user_uuid);
  END IF;

  IF user_uuid = caller THEN
    RETURN (SELECT role FROM public.user_roles WHERE user_id = caller);
  END IF;

  SELECT role INTO caller_role FROM public.user_roles WHERE user_id = caller;

  IF caller_role IN ('admin', 'admin_master') THEN
    RETURN (SELECT role FROM public.user_roles WHERE user_id = user_uuid);
  END IF;

  RETURN NULL;
END;
$function$;

-- 2) Harden ensure_user_profile: callers may only bootstrap their own profile
CREATE OR REPLACE FUNCTION public.ensure_user_profile(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  user_email text;
  user_name text;
  profile_exists boolean;
  role_exists boolean;
BEGIN
  IF caller IS NOT NULL AND user_uuid IS DISTINCT FROM caller THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_uuid) INTO profile_exists;
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = user_uuid) INTO role_exists;

  IF NOT profile_exists THEN
    SELECT email, COALESCE(raw_user_meta_data->>'name', email)
    INTO user_email, user_name
    FROM auth.users
    WHERE id = user_uuid;

    INSERT INTO public.profiles (id, email, name)
    VALUES (user_uuid, user_email, user_name);
  END IF;

  IF NOT role_exists THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_uuid, 'operador');
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_user_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(uuid) TO authenticated;

-- 3) notification_events: explicit deny of client-side inserts (rows are created
--    only by SECURITY DEFINER triggers, which bypass RLS)
DROP POLICY IF EXISTS "No client inserts on notification_events" ON public.notification_events;
CREATE POLICY "No client inserts on notification_events"
ON public.notification_events
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

REVOKE INSERT, UPDATE, DELETE ON public.notification_events FROM authenticated, anon;