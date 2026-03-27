
-- Tabela de movimentações do saldo bancário
CREATE TABLE public.balance_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partnership_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tipo text NOT NULL, -- 'deposito', 'debito', 'ajuste_manual'
  valor numeric NOT NULL,
  saldo_anterior numeric NOT NULL DEFAULT 0,
  saldo_novo numeric NOT NULL DEFAULT 0,
  descricao text,
  referencia_id uuid, -- pode ser arbitrage_id ou null
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.balance_movements ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver suas próprias movimentações
CREATE POLICY "Usuários podem ver suas movimentações"
ON public.balance_movements FOR SELECT
USING (auth.uid() = user_id);

-- Admins podem ver todas as movimentações
CREATE POLICY "Admins podem ver todas as movimentações"
ON public.balance_movements FOR SELECT
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::user_role, 'admin_master'::user_role]));

-- Usuários podem inserir suas próprias movimentações
CREATE POLICY "Usuários podem inserir movimentações"
ON public.balance_movements FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Índice para busca por parceria
CREATE INDEX idx_balance_movements_partnership ON public.balance_movements(partnership_id, created_at DESC);
