
-- Add annotation fields to custom_betting_houses
ALTER TABLE public.custom_betting_houses 
ADD COLUMN annotation TEXT DEFAULT NULL,
ADD COLUMN annotation_color TEXT DEFAULT '#6366f1';

-- Also add to static houses via a separate table for annotations on static houses
CREATE TABLE public.house_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  house_id TEXT NOT NULL,
  annotation TEXT NOT NULL,
  annotation_color TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(house_id)
);

ALTER TABLE public.house_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver anotações" ON public.house_annotations
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem criar anotações" ON public.house_annotations
FOR INSERT WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

CREATE POLICY "Admins podem atualizar anotações" ON public.house_annotations
FOR UPDATE USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

CREATE POLICY "Admins podem deletar anotações" ON public.house_annotations
FOR DELETE USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));
