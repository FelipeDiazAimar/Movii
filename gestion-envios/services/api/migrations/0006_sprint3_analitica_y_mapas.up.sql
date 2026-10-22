-- HU-12: coordenadas de cada destino para dibujar la ruta en el mapa.
ALTER TABLE destinatarios
  ADD COLUMN IF NOT EXISTS latitud NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS longitud NUMERIC(10, 7);

-- HU-11/13/14/15: índices para las agregaciones por estado, motivo, actor y período.
CREATE INDEX IF NOT EXISTS idx_eventos_envio_estado_fecha ON eventos_envio (estado_nuevo, created_at);
CREATE INDEX IF NOT EXISTS idx_eventos_envio_motivo ON eventos_envio (motivo) WHERE motivo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_envio_actor_fecha ON eventos_envio (actor_id, created_at) WHERE actor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_envios_created_at ON envios (created_at);

-- Backfill de demo: coordenadas aproximadas (±1 km) alrededor de San Francisco (Córdoba)
-- para los destinos existentes. Los destinos nuevos quedan sin coordenadas hasta
-- que haya geocodificación real (el mapa los lista como "sin ubicación").
UPDATE destinatarios
SET latitud = -31.4279718 + (random() * 0.02 - 0.01),
    longitud = -62.0826608 + (random() * 0.02 - 0.01)
WHERE latitud IS NULL;
