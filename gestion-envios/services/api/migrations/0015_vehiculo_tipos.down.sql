UPDATE vehiculos SET tipo = 'utilitario' WHERE tipo IN ('camioneta', 'auto');
ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_tipo_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_tipo_check
    CHECK (tipo IN ('camion', 'furgon', 'utilitario', 'moto'));
