-- Sprint 2 (HU-08/09): evidencia de entrega y datos de reprogramación.
--
-- Firma y foto se guardan como BYTEA en la misma base (decisión Sprint 2):
-- funciona idéntico en Postgres local y en Supabase, sin sumar infra nueva
-- (ni Storage ni RLS) a mitad del sprint. Límite: 5 MB por imagen, validado
-- en el service (HTTP 413 si se supera). Si a futuro el volumen lo pide, se
-- migra a Supabase Storage guardando URLs en estas mismas columnas lógicas.
-- La API recibe las imágenes en base64 dentro del JSON (convención JSON-only
-- del proyecto) y nunca las devuelve dentro de listados: el detalle expone
-- metadata + URLs binarias (/confirmacion/firma y /confirmacion/foto).

CREATE TYPE franja_horaria AS ENUM ('manana', 'tarde', 'noche');

CREATE TYPE relacion_receptor AS ENUM (
    'destinatario',
    'familiar',
    'vecino',
    'encargado'
);

-- Una fila por envío entregado (PK = envio_id: no hay doble confirmación).
-- Tabla separada (no columnas en envios) para no cargar BYTEAs en listados.
CREATE TABLE confirmaciones_entrega (
    envio_id UUID PRIMARY KEY REFERENCES envios(id) ON DELETE CASCADE,
    receptor_nombre VARCHAR(100) NOT NULL,
    receptor_relacion relacion_receptor NOT NULL,
    firma BYTEA NOT NULL,
    foto BYTEA NOT NULL,
    confirmada_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    confirmada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reprogramación (HU-09): el envío vuelve a pendiente "para" una fecha.
-- Al asignarse a una ruta, la fecha de la ruta manda y estas columnas se
-- limpian (ver AsignarEnvios). Sin updated_at: son datos de un evento
-- puntual, el "cuándo" vive en eventos_envio.
ALTER TABLE envios ADD COLUMN reprogramado_para DATE;
ALTER TABLE envios ADD COLUMN franja franja_horaria;

CREATE INDEX idx_envios_reprogramado_para ON envios(reprogramado_para)
    WHERE reprogramado_para IS NOT NULL;
