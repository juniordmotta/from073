-- Atualizar constraint para incluir 'aguardando_verificacao'
ALTER TABLE public.partnership_houses DROP CONSTRAINT IF EXISTS partnership_houses_status_check;

ALTER TABLE public.partnership_houses ADD CONSTRAINT partnership_houses_status_check 
CHECK (status IN ('ativa', 'bloqueada', 'sacar', 'aguardando_pagamento', 'aguardando_verificacao'));