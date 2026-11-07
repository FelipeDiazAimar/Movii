-- Sprint 3 (HU-11, HU-12, HU-18): flota de vehículos, vehículo asignado a la
-- ruta del día y origen de las coordenadas de cada destino.

CREATE TABLE IF NOT EXISTS vehiculos (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patente           VARCHAR(15)   NOT NULL UNIQUE,
    modelo            VARCHAR(60)   NOT NULL,
    tipo              VARCHAR(20)   NOT NULL DEFAULT 'camion' CHECK (tipo IN ('camion', 'furgon', 'utilitario', 'moto')),
    capacidad_peso    NUMERIC(8, 2) NOT NULL DEFAULT 4500 CHECK (capacidad_peso > 0),
    capacidad_volumen NUMERIC(8, 2) NOT NULL DEFAULT 25 CHECK (capacidad_volumen > 0),
    estado            VARCHAR(20)   NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'en_base', 'mantenimiento')),
    -- Telemetría (GPS simulado en la demo; ver services/simulador_service.go).
    latitud           NUMERIC(10, 7) NOT NULL DEFAULT -31.4279718,
    longitud          NUMERIC(10, 7) NOT NULL DEFAULT -62.0826608,
    velocidad         NUMERIC(5, 1)  NOT NULL DEFAULT 0,
    rumbo             NUMERIC(5, 1)  NOT NULL DEFAULT 0,
    temperatura       NUMERIC(4, 1)  NOT NULL DEFAULT 4,
    posicion_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
    created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_vehiculos_updated_at BEFORE UPDATE ON vehiculos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Una ruta se recorre con un vehículo; un vehículo no puede tener dos rutas el mismo día.
ALTER TABLE rutas ADD COLUMN IF NOT EXISTS vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_rutas_vehiculo_fecha ON rutas (vehiculo_id, fecha) WHERE vehiculo_id IS NOT NULL;

-- De dónde salió la coordenada del destino: 'nominatim' (geocodificada),
-- 'aproximada' (centro de la localidad) o 'demo' (backfill aleatorio de 0006,
-- se vuelve a geocodificar en segundo plano).
ALTER TABLE destinatarios ADD COLUMN IF NOT EXISTS geo_fuente VARCHAR(12);
UPDATE destinatarios SET geo_fuente = 'demo' WHERE latitud IS NOT NULL AND geo_fuente IS NULL;

INSERT INTO vehiculos (id, patente, modelo, tipo, capacidad_peso, capacidad_volumen, estado, temperatura, latitud, longitud) VALUES
    ('88888888-8888-8888-8888-888888888881', 'TRK-318', 'Mercedes-Benz Accelo 1016', 'camion', 5000, 28, 'activo', 4, -31.4279718, -62.0826608),
    ('88888888-8888-8888-8888-888888888882', 'FUR-102', 'Renault Master L2H2', 'furgon', 1500, 12, 'en_base', 18, -31.4279718, -62.0826608),
    ('88888888-8888-8888-8888-888888888883', 'CAM-205', 'Iveco Daily 55C17', 'camion', 3800, 20, 'mantenimiento', 21, -31.4279718, -62.0826608)
ON CONFLICT (patente) DO NOTHING;

UPDATE rutas SET vehiculo_id = '88888888-8888-8888-8888-888888888881'
WHERE id = '77777777-7777-7777-7777-777777777777' AND vehiculo_id IS NULL;
