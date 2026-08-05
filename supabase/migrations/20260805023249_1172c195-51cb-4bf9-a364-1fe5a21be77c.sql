REVOKE ALL ON FUNCTION public.ensure_user_profile(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(uuid) TO service_role;