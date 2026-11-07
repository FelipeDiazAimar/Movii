DROP TABLE IF EXISTS notificaciones_whatsapp;
DROP TABLE IF EXISTS codigos_otp;
DROP INDEX IF EXISTS uq_usuarios_telefono;
ALTER TABLE usuarios DROP COLUMN IF EXISTS telefono;
