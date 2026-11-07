-- DOWN de 0009_fecha_entrega.
DROP INDEX IF EXISTS idx_envios_fecha_entrega;
ALTER TABLE envios DROP COLUMN IF EXISTS fecha_entrega;
