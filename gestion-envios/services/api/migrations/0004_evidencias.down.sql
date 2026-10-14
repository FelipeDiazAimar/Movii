-- DOWN de 0004_evidencias: borra evidencias, columnas de reprogramación y tipos.

DROP INDEX IF EXISTS idx_envios_reprogramado_para;
ALTER TABLE envios DROP COLUMN IF EXISTS franja;
ALTER TABLE envios DROP COLUMN IF EXISTS reprogramado_para;
DROP TABLE IF EXISTS confirmaciones_entrega;
DROP TYPE IF EXISTS relacion_receptor;
DROP TYPE IF EXISTS franja_horaria;
