
ALTER TABLE public.partnerships ADD COLUMN IF NOT EXISTS saldo_bancario numeric NOT NULL DEFAULT 0;
