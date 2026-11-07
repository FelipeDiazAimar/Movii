-- Color propio de cada vehículo (#RRGGBB); vacío = color automático.
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '';
