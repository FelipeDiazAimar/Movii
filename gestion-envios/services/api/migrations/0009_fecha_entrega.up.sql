-- Fecha de entrega del envío: es la fecha que ve el repartidor. La fecha de
-- la ruta deja de decidir qué se entrega cada día.
-- Idempotente: la columna puede existir ya en bases donde se agregó a mano.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'envios' AND column_name = 'fecha_entrega') THEN
    ALTER TABLE envios ADD COLUMN fecha_entrega DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date);

    -- Envíos existentes: la fecha que ya regía (reprogramación, o fecha de la ruta).
    UPDATE envios e
    SET fecha_entrega = COALESCE(e.reprogramado_para, (SELECT r.fecha FROM rutas r WHERE r.id = e.ruta_id), e.created_at::date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_envios_fecha_entrega ON envios(fecha_entrega);
