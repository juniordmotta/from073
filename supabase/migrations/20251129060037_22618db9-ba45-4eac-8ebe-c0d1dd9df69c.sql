-- Adicionar constraint única para evitar duplicatas
ALTER TABLE monthly_goals
DROP CONSTRAINT IF EXISTS monthly_goals_user_id_partnership_id_month_key;

ALTER TABLE monthly_goals
ADD CONSTRAINT monthly_goals_user_id_partnership_id_month_key 
UNIQUE NULLS NOT DISTINCT (user_id, partnership_id, month);