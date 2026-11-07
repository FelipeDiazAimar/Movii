ALTER TABLE destinatarios DROP COLUMN IF EXISTS geo_fuente;
DROP INDEX IF EXISTS uq_rutas_vehiculo_fecha;
ALTER TABLE rutas DROP COLUMN IF EXISTS vehiculo_id;
DROP TABLE IF EXISTS vehiculos;
