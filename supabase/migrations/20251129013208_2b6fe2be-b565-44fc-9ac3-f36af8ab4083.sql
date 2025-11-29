-- Create partnerships_history table
CREATE TABLE public.partnerships_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partnerships_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Usuários podem ver histórico de suas parcerias"
ON public.partnerships_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todo histórico"
ON public.partnerships_history
FOR SELECT
USING (get_user_role(auth.uid()) IN ('admin', 'admin_master'));

CREATE POLICY "Sistema pode inserir histórico"
ON public.partnerships_history
FOR INSERT
WITH CHECK (true);

-- Create function to log partnership changes
CREATE OR REPLACE FUNCTION log_partnership_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log nome_completo change
  IF OLD.nome_completo IS DISTINCT FROM NEW.nome_completo THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'nome_completo', OLD.nome_completo, NEW.nome_completo);
  END IF;
  
  -- Log cpf change
  IF OLD.cpf IS DISTINCT FROM NEW.cpf THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'cpf', OLD.cpf, NEW.cpf);
  END IF;
  
  -- Log endereco change
  IF OLD.endereco IS DISTINCT FROM NEW.endereco THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'endereco', OLD.endereco, NEW.endereco);
  END IF;
  
  -- Log valor_banca change
  IF OLD.valor_banca IS DISTINCT FROM NEW.valor_banca THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'valor_banca', OLD.valor_banca::text, NEW.valor_banca::text);
  END IF;
  
  -- Log bancos_cadastrados change
  IF OLD.bancos_cadastrados IS DISTINCT FROM NEW.bancos_cadastrados THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'bancos_cadastrados', OLD.bancos_cadastrados, NEW.bancos_cadastrados);
  END IF;
  
  -- Log status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO partnerships_history (partnership_id, user_id, changed_by, field_changed, old_value, new_value)
    VALUES (NEW.id, NEW.user_id, auth.uid(), 'status', OLD.status, NEW.status);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for partnership changes
CREATE TRIGGER partnerships_changes_trigger
AFTER UPDATE ON public.partnerships
FOR EACH ROW
EXECUTE FUNCTION log_partnership_changes();

-- Create indexes for better performance
CREATE INDEX idx_partnerships_history_partnership_id ON public.partnerships_history(partnership_id);
CREATE INDEX idx_partnerships_history_user_id ON public.partnerships_history(user_id);
CREATE INDEX idx_partnerships_history_changed_at ON public.partnerships_history(changed_at DESC);