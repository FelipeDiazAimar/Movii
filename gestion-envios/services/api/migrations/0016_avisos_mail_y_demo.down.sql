DELETE FROM notificaciones_whatsapp WHERE estado = 'simulado' OR canal = 'mail';
ALTER TABLE notificaciones_whatsapp DROP CONSTRAINT IF EXISTS notificaciones_whatsapp_estado_check;
ALTER TABLE notificaciones_whatsapp ADD CONSTRAINT notificaciones_whatsapp_estado_check
    CHECK (estado IN ('pendiente', 'enviado', 'fallido', 'omitido'));
ALTER TABLE notificaciones_whatsapp DROP CONSTRAINT IF EXISTS notificaciones_whatsapp_canal_check;
ALTER TABLE notificaciones_whatsapp DROP COLUMN IF EXISTS canal;
ALTER TABLE notificaciones_whatsapp ALTER COLUMN telefono TYPE VARCHAR(20) USING left(telefono, 20);
ALTER TABLE destinatarios DROP COLUMN IF EXISTS demo;
ALTER TABLE destinatarios DROP COLUMN IF EXISTS email;
