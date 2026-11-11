DROP TRIGGER IF EXISTS trg_envios_estado_ruta ON envios;
DROP FUNCTION IF EXISTS trg_envios_estado_ruta();
DROP FUNCTION IF EXISTS recalcular_estado_ruta(UUID);
