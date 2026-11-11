-- Dos modelos nuevos de vehículo: camioneta (pickup con caja) y auto (hatchback de reparto liviano).
ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_tipo_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_tipo_check
    CHECK (tipo IN ('camion', 'furgon', 'utilitario', 'moto', 'camioneta', 'auto'));
