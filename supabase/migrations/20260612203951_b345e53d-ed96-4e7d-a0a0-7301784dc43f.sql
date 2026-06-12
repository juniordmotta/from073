
-- notification_events: log automatico
CREATE TABLE public.notification_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins veem eventos" ON public.notification_events FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role,'admin_master'::user_role]));
CREATE INDEX idx_notification_events_created ON public.notification_events(created_at DESC);

-- notifications: disparadas pelo admin
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos autenticados leem notificacoes" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins criam notificacoes" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role,'admin_master'::user_role]) AND created_by = auth.uid());
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);

-- notification_reads: por usuario
CREATE TABLE public.notification_reads (
  user_id UUID NOT NULL,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);
GRANT SELECT, INSERT, DELETE ON public.notification_reads TO authenticated;
GRANT ALL ON public.notification_reads TO service_role;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia proprias leituras select" ON public.notification_reads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Usuario gerencia proprias leituras insert" ON public.notification_reads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuario gerencia proprias leituras delete" ON public.notification_reads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Trigger functions
CREATE OR REPLACE FUNCTION public.log_custom_house_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('house_added', NEW.name, jsonb_build_object('group_id', NEW.group_id, 'house_id', NEW.id));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('house_deleted', OLD.name, jsonb_build_object('group_id', OLD.group_id, 'house_id', OLD.id));
  ELSIF TG_OP = 'UPDATE' AND OLD.group_id IS DISTINCT FROM NEW.group_id THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('house_moved', NEW.name, jsonb_build_object('from_group', OLD.group_id, 'to_group', NEW.group_id, 'house_id', NEW.id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_log_custom_house AFTER INSERT OR UPDATE OR DELETE ON public.custom_betting_houses
  FOR EACH ROW EXECUTE FUNCTION public.log_custom_house_event();

CREATE OR REPLACE FUNCTION public.log_hidden_house_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('house_status_changed', NEW.house_name, jsonb_build_object('action', 'hidden', 'group_id', NEW.group_id));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('house_status_changed', OLD.house_name, jsonb_build_object('action', 'restored', 'group_id', OLD.group_id));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
CREATE TRIGGER trg_log_hidden_house AFTER INSERT OR DELETE ON public.hidden_betting_houses
  FOR EACH ROW EXECUTE FUNCTION public.log_hidden_house_event();

CREATE OR REPLACE FUNCTION public.log_custom_group_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notification_events(event_type, entity_name, details)
    VALUES ('group_added', NEW.nome, jsonb_build_object('group_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_log_custom_group AFTER INSERT ON public.custom_betting_groups
  FOR EACH ROW EXECUTE FUNCTION public.log_custom_group_event();
