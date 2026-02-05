-- Adicionar coluna de saldo/valor para cada casa da parceria
ALTER TABLE public.partnership_houses
ADD COLUMN saldo NUMERIC(12,2) NOT NULL DEFAULT 0.00;