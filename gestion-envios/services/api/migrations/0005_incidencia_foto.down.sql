-- DOWN de 0005_incidencia_foto: quita la columna de foto de incidencia.

ALTER TABLE eventos_envio DROP COLUMN IF EXISTS foto;
