-- Alterar precisão das colunas de odds para aceitar 3 casas decimais
ALTER TABLE arbitrages 
  ALTER COLUMN casa_01_odd TYPE NUMERIC(10,3),
  ALTER COLUMN casa_02_odd TYPE NUMERIC(10,3),
  ALTER COLUMN casa_03_odd TYPE NUMERIC(10,3);