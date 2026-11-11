-- El estado de la ruta se deriva de sus envíos (antes nada lo actualizaba y
-- todas las rutas quedaban "planificada"):
--   sin envíos pendientes de entrega (asignado/en_camino) -> completada
--   con alguno en camino o ya resuelto                     -> en_curso
--   si no                                                  -> planificada
-- Una ruta sin envíos conserva el estado que tenga.
CREATE OR REPLACE FUNCTION recalcular_estado_ruta(p_ruta UUID) RETURNS void AS $$
BEGIN
    IF p_ruta IS NULL THEN
        RETURN;
    END IF;
    UPDATE rutas r SET estado = CASE
            WHEN NOT EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id AND e.estado IN ('asignado', 'en_camino'))
                THEN 'completada'::estado_ruta
            WHEN EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id AND e.estado IN ('en_camino', 'entregado', 'no_entregado'))
                THEN 'en_curso'::estado_ruta
            ELSE 'planificada'::estado_ruta
        END
    WHERE r.id = p_ruta
      AND EXISTS (SELECT 1 FROM envios e WHERE e.ruta_id = r.id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_envios_estado_ruta() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        PERFORM recalcular_estado_ruta(NEW.ruta_id);
    END IF;
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.ruta_id IS DISTINCT FROM (CASE WHEN TG_OP = 'UPDATE' THEN NEW.ruta_id END) THEN
        PERFORM recalcular_estado_ruta(OLD.ruta_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_envios_estado_ruta ON envios;
CREATE TRIGGER trg_envios_estado_ruta
    AFTER INSERT OR DELETE OR UPDATE OF estado, ruta_id ON envios
    FOR EACH ROW EXECUTE FUNCTION trg_envios_estado_ruta();

-- Poner al día las rutas existentes.
SELECT recalcular_estado_ruta(id) FROM rutas;
