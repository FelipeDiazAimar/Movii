DROP INDEX IF EXISTS idx_envios_created_at;
DROP INDEX IF EXISTS idx_eventos_envio_actor_fecha;
DROP INDEX IF EXISTS idx_eventos_envio_motivo;
DROP INDEX IF EXISTS idx_eventos_envio_estado_fecha;
ALTER TABLE destinatarios DROP COLUMN IF EXISTS longitud;
ALTER TABLE destinatarios DROP COLUMN IF EXISTS latitud;
