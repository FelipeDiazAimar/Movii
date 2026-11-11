DROP INDEX IF EXISTS idx_envios_ruta_orden;
ALTER TABLE envios DROP COLUMN IF EXISTS orden_ruta;
