-- Criar tabela de categorias para anotações
CREATE TABLE public.note_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  cor text DEFAULT '#6366f1',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Adicionar coluna category_id na tabela notes
ALTER TABLE public.notes ADD COLUMN category_id uuid REFERENCES public.note_categories(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE public.note_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para categorias
CREATE POLICY "Usuários podem ver suas próprias categorias"
  ON public.note_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as categorias"
  ON public.note_categories FOR SELECT
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

CREATE POLICY "Usuários podem criar suas próprias categorias"
  ON public.note_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias categorias"
  ON public.note_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias categorias"
  ON public.note_categories FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_note_categories_updated_at
  BEFORE UPDATE ON public.note_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();