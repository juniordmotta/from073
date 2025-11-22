-- Criar índices para melhorar performance das queries

-- Índice composto para queries de arbitragens por usuário e data
CREATE INDEX IF NOT EXISTS idx_arbitrages_user_date 
ON arbitrages(user_id, data_evento DESC);

-- Índice para queries por status
CREATE INDEX IF NOT EXISTS idx_arbitrages_status 
ON arbitrages(status);

-- Índice composto para queries por usuário e status
CREATE INDEX IF NOT EXISTS idx_arbitrages_user_status 
ON arbitrages(user_id, status);

-- Índice para created_at usado em filtros
CREATE INDEX IF NOT EXISTS idx_arbitrages_created_at 
ON arbitrages(created_at DESC);

-- Índice composto para data de evento e status (usado no dashboard)
CREATE INDEX IF NOT EXISTS idx_arbitrages_date_status 
ON arbitrages(data_evento DESC, status);

-- Índice para operational_costs por usuário e data
CREATE INDEX IF NOT EXISTS idx_operational_costs_user_date 
ON operational_costs(user_id, data DESC);

-- Índice para profiles (já deve existir pela primary key, mas garantir)
CREATE INDEX IF NOT EXISTS idx_profiles_id 
ON profiles(id);

-- Índice para user_roles para lookup rápido
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);