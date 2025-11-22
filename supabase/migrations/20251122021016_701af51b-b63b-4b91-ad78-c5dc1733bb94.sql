-- Atualizar apostas existentes sem mercado com valor padrão
UPDATE arbitrages
SET casa_01_mercado = 'Mercado não especificado'
WHERE casa_01_mercado IS NULL;

UPDATE arbitrages
SET casa_02_mercado = 'Mercado não especificado'
WHERE casa_02_mercado IS NULL;

UPDATE arbitrages
SET casa_03_mercado = 'Mercado não especificado'
WHERE casa_03_mercado IS NULL AND casa_03_nome IS NOT NULL;

-- Tornar os campos de mercado obrigatórios para apostas futuras
ALTER TABLE arbitrages
ALTER COLUMN casa_01_mercado SET NOT NULL,
ALTER COLUMN casa_01_mercado SET DEFAULT 'Mercado não especificado';

ALTER TABLE arbitrages
ALTER COLUMN casa_02_mercado SET NOT NULL,
ALTER COLUMN casa_02_mercado SET DEFAULT 'Mercado não especificado';