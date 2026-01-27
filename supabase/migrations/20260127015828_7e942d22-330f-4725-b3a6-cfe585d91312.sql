-- Adicionar 'cashout' ao enum arbitrage_status
ALTER TYPE public.arbitrage_status ADD VALUE IF NOT EXISTS 'cashout';